const qiniu = require('qiniu');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');

/**
 * 上传数据到七牛云
 * @param {Object} data 要上传的数据
 * @returns {Promise<string>} 上传后的文件访问链接
 */
async function uploadData(data) {
    try {
        // 添加数据验证
        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error('没有数据需要上传');
        }

        // 生成文件名
        const timestamp = new Date().getTime();
        const key = `jobs_${timestamp}.json`;

        console.log('准备上传数据文件:', key);

        // 创建认证对象
        const mac = new qiniu.auth.digest.Mac(
            config.qiniu.accessKey,
            config.qiniu.secretKey
        );

        // 创建上传凭证
        const options = {
            scope: `${config.qiniu.bucket}:${key}`,
            returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}'
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const uploadToken = putPolicy.uploadToken(mac);

        // 配置上传参数
        const qiniuConfig = new qiniu.conf.Config();
        qiniuConfig.zone = qiniu.zone.Zone_z2;  // 华南区域
        qiniuConfig.useCdnDomain = true;

        // 创建表单上传对象
        const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
        const putExtra = new qiniu.form_up.PutExtra();

        // 将数据转换为 Buffer
        const dataBuffer = Buffer.from(JSON.stringify(data, null, 2));

        // 执行上传
        return new Promise((resolve, reject) => {
            formUploader.put(uploadToken, key, dataBuffer, putExtra, (err, body, info) => {
                if (err) {
                    console.error('七牛云上传错误:', err);
                    return reject(err);
                }

                if (info.statusCode === 200) {
                    const fileUrl = `http://${config.qiniu.domain}/${body.key}`;
                    console.log('上传成功:', fileUrl);
                    resolve(fileUrl);
                } else {
                    console.error('上传失败:', info.statusCode, body);
                    reject(new Error(`上传失败: ${info.statusCode}`));
                }
            });
        });
    } catch (error) {
        console.error('七牛云上传过程出错:', error);
        throw error;
    }
}

/**
 * 测试七牛云配置
 */
async function testConfig() {
    try {
        const mac = new qiniu.auth.digest.Mac(
            config.qiniu.accessKey,
            config.qiniu.secretKey
        );

        const qiniuConfig = new qiniu.conf.Config();
        qiniuConfig.zone = qiniu.zone.Zone_z2;

        const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);

        // 只检查存储空间信息，不上传测试文件
        return new Promise((resolve, reject) => {
            bucketManager.getBucketInfo(config.qiniu.bucket, (err, respBody, respInfo) => {
                if (err) {
                    console.error('七牛云配置测试失败:', err);
                    reject(err);
                } else if (respInfo.statusCode !== 200) {
                    reject(new Error(`获取存储空间信息失败: ${respInfo.statusCode}`));
                } else {
                    console.log('七牛云配置测试成功，存储空间可用');
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('七牛云配置测试失败:', error);
        throw error;
    }
}

module.exports = {
    uploadData,
    testConfig
};