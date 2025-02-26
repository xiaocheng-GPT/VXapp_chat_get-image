// 云函数入口文件
const cloud = require('wx-server-sdk');
const axios = require('axios'); // 使用 axios 发起 HTTP 请求

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const db = cloud.database();

  const { action, type, inputText } = event;

  if (action === 'clearChatRecords') {
    return await clearChatRecords(db, wxContext);
  }

  if (action === 'updateAccessToken') {
    return await updateAccessToken(type);
  }

  if (action === 'generateImage') {
    if (!inputText) {
      return { success: false, message: "请输入有效的文本内容" };
    }
    return await generateImage(inputText);
  }

  return { success: false, message: "未匹配到任何有效的 action" };
};


// 清空聊天记录的函数
const clearChatRecords = async (db, wxContext) => {
  const collection = db.collection('chat_records'); // 定义集合名

  try {
    // 删除集合中的所有记录
    const result = await collection.where({}).remove();

    return {
      success: true,
      message: '记录已清空',
      deletedCount: result.stats.removed, // 返回删除的记录数
      openid: wxContext.OPENID,
    };
  } catch (error) {
    return {
      success: false,
      message: '记录清空失败',
      error,
      openid: wxContext.OPENID,
    };
  }
};

// 更新 Access Token 的函数
const updateAccessToken = async (type) => {
  let token;
  
  if (type === 'access_token') {
    // 获取或更新普通的 access_token，语言模型
    token = await getAccessToken();
  } else if (type === 'image_access_token') {
    // 获取或更新 image_access_token，图像理解
    token = await getImageAccessToken();
  } else if (type === 'photo_access_token') {
    // 获取或更新 photo_access_token，AI绘画模型
    token = await fetchPhotoAccessToken();}
  else {
    return {
      success: false,
      message: '无效的类型',
    };
  }

  // 返回更新后的 token
  return {
    success: true,
    message: `${type} 更新成功`,
    token,
  };
};

// 获取普通 access_token 的函数
const getAccessToken = async () => {
  const client_id = 'lx8ipyCttFFZ8AxT8I1nMPWS';  // 使用你的 client_id
  const client_secret = 'og1LZg7BnUqH28OnucFgZe5v2VmPugW5';  // 使用你的 client_secret

  // 拼接请求 URL
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`;

  try {
    const response = await axios.post(url);
    const result = response.data;
    if (result && result.access_token) {
      return result.access_token;
    } else {
      throw new Error('无法获取 access_token');
    }
  } catch (error) {
    return `获取 access_token 失败: ${error.message}`;
  }
};

// 获取 image_access_token 的函数
const getImageAccessToken = async () => {
  const client_id = 'mCdWwSPvcYjHkgrgtLPBSr1w';  // 使用你的 image client_id
  const client_secret = 'zK5ck35AhMCKRfORBn9buXWABh0j5oq4';  // 使用你的 image client_secret

  // 拼接请求 URL
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`;

  try {
    const response = await axios.post(url);
    const result = response.data;
    if (result && result.access_token) {
      return result.access_token;
    } else {
      throw new Error('无法获取 image_access_token');
    }
  } catch (error) {
    return `获取 image_access_token 失败: ${error.message}`;
  }
};
// 获取 photo_access_token 的函数，文生图token
const fetchPhotoAccessToken = async () => {
  const client_id = '3ZIZT0oEnJJDoStaPGNssHna';  // 使用你的 client_id
  const client_secret = 'fWf2dmWI9z18FwVRGDB8d8SzCs38i7gM';  // 使用你的 client_secret

  // 拼接请求 URL
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`;

  try {
    const response = await axios.post(url);
    const result = response.data;
    if (result && result.access_token) {
      return result.access_token;
    } else {
      throw new Error('无法获取 photo_access_token');
    }
  } catch (error) {
    return `获取 photo_access_token 失败: ${error.message}`;
  }
};

// 生成图像的函数
const generateImage = async (inputText) => {
  // 获取 access_token
  const accessToken = await fetchPhotoAccessToken("photo_access_token"); // 获取 photo_access_token
  if (!accessToken) {
    return { success: false, message: "无法读取 photo_access_token" };
  }

  // 构造请求的 URL
  const url = `https://aip.baidubce.com/rpc/2.0/wenxin/v1/basic/textToImage?access_token=${accessToken}`;
  const payload = {
    text: inputText,
    resolution: "1024*1024",
    num: 1,
  };

  try {
    // 发起 HTTP 请求生成图像
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });

    const data = response.data;
    if (data && data.data && data.data.taskId) {
      return { success: true, taskId: data.data.taskId };
    }
    return { success: false, message: "图片生成失败，未返回 taskId" };
  } catch (error) {
    console.error("生成文生图失败:", error);
    return { success: false, message: "图片生成请求失败" };
  }
};
