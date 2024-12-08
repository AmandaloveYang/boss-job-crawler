const { fetchAndUploadJobs } = require('./utils/scraper');
require('dotenv').config();

async function main() {
    try {
        console.log('开始获取职位数据...');

        const params = {
            query: '前端开发工程师',
            city: '成都'
        };

        await fetchAndUploadJobs(params.query, params.city);
        console.log('任务完成！');

    } catch (error) {
        console.error('程序执行失败:', error);
    } finally {
        // 确保程序可以正常退出
        process.exit(0);
    }
}

// 只执行一次主函数
main().catch(error => {
    console.error('未捕获的错误:', error);
    process.exit(1);
}); 