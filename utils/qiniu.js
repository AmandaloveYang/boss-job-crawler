const qiniu = require('qiniu');
const path = require('path');
const fs = require('fs').promises;

// 七牛云配置
const config = {
    accessKey: '您的accessKey',
    secretKey: '您的secretKey',
    bucket: 'zpdata',
    zone: 'z2', // 华南区域
    domain: '您的域名'
};

/**
 * 上传文件到七牛云
 * @param {string} localFile 本地文件路径
 * @param {string} key 文件名
 * @returns {Promise<string>} 上传后的文件访问链接
 */
async function uploadToQiniu(localFile, key) {
    // 创建认证对象
    const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);

    // 创建配置对象
    const qiniuConfig = new qiniu.conf.Config();
    // 设置区域为华南区域
    qiniuConfig.zone = qiniu.zone.Zone_z2;
    qiniuConfig.useCdnDomain = true;

    // 创建上传凭证
    const options = {
        scope: config.bucket,
        expires: 7200
    };
    const putPolicy = new qiniu.rs.PutPolicy(options);
    const uploadToken = putPolicy.uploadToken(mac);

    // 创建表单上传对象
    const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
    const putExtra = new qiniu.form_up.PutExtra();

    return new Promise((resolve, reject) => {
        formUploader.putFile(uploadToken, key, localFile, putExtra, (err, body, info) => {
            if (err) {
                return reject(err);
            }

            if (info.statusCode === 200) {
                const fileUrl = `http://${config.domain}/${body.key}`;
                resolve(fileUrl);
            } else {
                console.error('七牛云响应:', info.statusCode, body);
                reject(new Error(`上传失败: ${info.statusCode} ${JSON.stringify(body)}`));
            }
        });
    });
}

/**
 * 上传数据到七牛云
 * @param {Object} data 要上传的数据
 * @returns {Promise<string>} 上传后的文件访问链接
 */
async function uploadData(data) {
    try {
        // 确保临时目录存在
        const tempDir = path.join(__dirname, '../temp');
        try {
            await fs.access(tempDir);
        } catch {
            await fs.mkdir(tempDir, { recursive: true });
        }

        // 生成临时文件名
        const timestamp = new Date().getTime();
        const fileName = `jobs_${timestamp}.json`;
        const tempFile = path.join(tempDir, fileName);

        // 写入临时文件
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2));

        console.log('开始上传到七牛云...');
        const fileUrl = await uploadToQiniu(tempFile, fileName);
        console.log('上传成功:', fileUrl);

        // 删除临时文件
        await fs.unlink(tempFile).catch(err => {
            console.warn('清理临时文件失败:', err);
        });

        return fileUrl;
    } catch (error) {
        console.error('上传数据失败:', error);
        throw error;
    }
}

// 测试配置是否正确
async function testConfig() {
    try {
        const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
        const bucketManager = new qiniu.rs.BucketManager(mac, new qiniu.conf.Config());

        console.log('正在测试七牛云配置...');
        await new Promise((resolve, reject) => {
            bucketManager.getBucketInfo(config.bucket, (err, respBody, respInfo) => {
                if (err) {
                    reject(err);
                } else if (respInfo.statusCode !== 200) {
                    reject(new Error(`获取存储空间信息失败: ${respInfo.statusCode}`));
                } else {
                    console.log('存储空间信息:', respBody);
                    resolve(respBody);
                }
            });
        });
    } catch (error) {
        console.error('配置测试失败:', error);
        throw error;
    }
}

module.exports = {
    uploadToQiniu,
    uploadData,
    testConfig
}; 