require('dotenv').config();

module.exports = {
  qiniu: {
    accessKey: process.env.QINIU_ACCESS_KEY,
    secretKey: process.env.QINIU_SECRET_KEY,
    bucket: process.env.QINIU_BUCKET,
    domain: process.env.QINIU_DOMAIN,
    zone: 'Zone_z2',  // 华南区域
    uploadUrl: 'https://up-z2.qiniup.com'
  },
  scraper: {
    targetUrl: process.env.TARGET_URL,
    rateLimit: parseInt(process.env.RATE_LIMIT),
    maxRetries: parseInt(process.env.MAX_RETRIES),
    pageTimeout: parseInt(process.env.PAGE_TIMEOUT),
    headless: process.env.HEADLESS !== 'false',  // 默认为 true
    userDataDir: process.env.USER_DATA_DIR,
    browserPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headers: {
      'accept': process.env.HTTP_HEADERS_ACCEPT,
      'accept-language': process.env.HTTP_HEADERS_ACCEPT_LANGUAGE,
      'cache-control': process.env.HTTP_HEADERS_CACHE_CONTROL,
      'sec-ch-ua': process.env.HTTP_HEADERS_SEC_CH_UA,
      'sec-ch-ua-mobile': process.env.HTTP_HEADERS_SEC_CH_UA_MOBILE,
      'sec-ch-ua-platform': process.env.HTTP_HEADERS_SEC_CH_UA_PLATFORM,
      'sec-fetch-dest': process.env.HTTP_HEADERS_SEC_FETCH_DEST,
      'sec-fetch-mode': process.env.HTTP_HEADERS_SEC_FETCH_MODE,
      'sec-fetch-site': process.env.HTTP_HEADERS_SEC_FETCH_SITE,
      'sec-fetch-user': process.env.HTTP_HEADERS_SEC_FETCH_USER,
      'upgrade-insecure-requests': process.env.HTTP_HEADERS_UPGRADE_INSECURE_REQUESTS,
      'user-agent': process.env.HTTP_HEADERS_USER_AGENT
    }
  },
  boss: {
    cookie: process.env.BOSS_COOKIE,
    defaultQuery: process.env.DEFAULT_SEARCH_QUERY,
    defaultCityCode: process.env.DEFAULT_CITY_CODE
  }
}; 