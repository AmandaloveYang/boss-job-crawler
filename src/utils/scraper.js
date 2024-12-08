const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { testConfig, uploadData } = require(path.join(__dirname, './qiniu'));

// 确保临时目录存在
async function ensureTempDir() {
    const tempDir = path.join(__dirname, '../temp');
    try {
        await fs.access(tempDir);
    } catch {
        await fs.mkdir(tempDir, { recursive: true });
    }
    return tempDir;
}

/**
 * 构建 BOSS 直聘搜索 URL
 * @param {Object} params 搜索参数
 * @param {string} params.query 搜索关键词
 * @param {string} params.city 城市代码
 * @returns {string} 编码后的 URL
 */
function buildSearchUrl(params = {}) {
    const defaultParams = {
        query: '前端开发工程师',
        city: '101270100'
    };

    // 确保参数是字符串
    const searchParams = {
        query: String(params.query || defaultParams.query),
        city: String(params.city || defaultParams.city)
    };

    // 正确编码查询参数
    const encodedQuery = encodeURIComponent(searchParams.query);
    const timestamp = new Date().getTime();

    const url = `https://www.zhipin.com/web/geek/job?query=${encodedQuery}&city=${searchParams.city}&t=${timestamp}`;

    console.log('访问 URL:', decodeURIComponent(url));
    return url;
}

// 城市代码映射
const CITY_CODES = {
    '成都': '101270100',
    '北京': '101010100',
    '上海': '101020100',
    '广州': '101280100',
    '深圳': '101280600',
    // 可以添加更多城市...
};

async function fetchAndUploadJobs(searchQuery = '前端开发工程师', cityName = '成都') {
    let browser;
    try {
        // 首先测试七牛云配置
        await testConfig();
        console.log('七牛云配置测试通过');

        console.log(`搜索条件: ${searchQuery} - ${cityName}`);

        browser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        });

        // 添加防缓存头
        const headers = {
            ...config.scraper.headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: headers,
            ignoreHTTPSErrors: true,
            bypassCSP: true
        });

        // 禁用缓存
        await context.route('**/*', async route => {
            const request = route.request();
            const headers = {
                ...request.headers(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
            await route.continue({ headers });
        });

        const page = await context.newPage();

        // 构建搜索 URL
        const cityCode = CITY_CODES[cityName] || '101270100';
        console.log(`使用城市代码: ${cityName} -> ${cityCode}`);

        const targetUrl = buildSearchUrl({
            query: searchQuery,
            city: cityCode
        });

        console.log('正在访问 BOSS 直聘...');

        // 修改等待策略
        await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded', // 改为只等待 DOM 加载
            timeout: config.scraper.pageTimeout
        });

        // 等待网络请求完成
        await page.waitForLoadState('networkidle', {
            timeout: config.scraper.pageTimeout
        }).catch(() => {
            console.log('等待网络空闲超时，继续执行...');
        });

        // 等待职位列表加载
        await page.waitForSelector('.job-list-box', {
            timeout: 30000,
            state: 'attached' // 确保元素已附加到 DOM
        });

        console.log('搜索结果加载完成');

        // 等待一下，确保结果完全加载
        await page.waitForTimeout(2000);

        // 开始抓取数据...
        const jobData = await page.evaluate(() => {
            const jobs = [];
            const jobItems = document.querySelectorAll('.job-card-wrapper');

            jobItems.forEach(item => {
                const job = {
                    title: item.querySelector('.job-name')?.innerText.trim(),
                    company: item.querySelector('.company-name')?.innerText.trim(),
                    salary: item.querySelector('.salary')?.innerText.trim(),
                    location: item.querySelector('.job-area')?.innerText.trim(),
                    tags: Array.from(item.querySelectorAll('.tag-list span')).map(tag => tag.innerText.trim()),
                    url: item.querySelector('a')?.href
                };
                jobs.push(job);
            });

            return jobs;
        });

        console.log(`成功获取到 ${jobData.length} 条职位信息`);

        // 上传数据...
        if (jobData && jobData.length > 0) {
            console.log('准备上传数据...');
            const fileUrl = await uploadData(jobData);
            console.log('数据上传成功，访问地址:', fileUrl);
        } else {
            console.warn('没有获取到职位数据，跳过上传');
        }

    } catch (error) {
        console.error('程序执行失败:', error);
        throw error;
    } finally {
        if (browser) {
            console.log('浏览器已关闭');
            await browser.close();
        }
    }
}

/**
 * 等待页面加载完成
 * @param {Page} page Puppeteer页面实例
 */
async function waitForPageLoad(page) {
    try {
        // 等待页面加载状态
        await page.waitForFunction(() => {
            return document.readyState === 'complete';
        }, { timeout: 30000 });

        // 额外等待一段时间，确保动态内容加载
        await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
        console.log('等待页面加载超时，继续执行...');
    }
}

/**
 * 处理页面加载重试
 * @param {Function} operation 要重试的操作函数
 * @param {number} maxRetries 最大重试次数
 * @param {number} delay 重试间隔时间(ms)
 */
async function retryOperation(operation, maxRetries = 3, delay = 5000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            console.log(`操作失败 (${i + 1}/${maxRetries}): ${error.message}`);
            lastError = error;

            if (i < maxRetries - 1) {
                console.log(`等待 ${delay / 1000} 秒后重试...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw lastError;
}

// 只导出需要的函数
module.exports = {
    fetchAndUploadJobs
}; 