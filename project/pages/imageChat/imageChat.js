const db = wx.cloud.database(); // 初始化数据库
const chatCollection = db.collection('chat'); // 定义集合

Page({
  data: {
    messages: [],        // 消息列表
    inputMessage: '',    // 用户输入的消息
    scrollToMessage: '', // 滚动到的消息
  },

  // 页面加载时恢复历史记录
  onLoad() {
    chatCollection.orderBy('timestamp', 'asc').watch({
      onChange: (snapshot) => {
        console.log('实时更新', snapshot.docs);
        this.setData({ messages: snapshot.docs });
      },
      onError: (err) => {
        console.error('监听失败', err);
      },
    });
  },

  // 输入框监听
  onInput(e) {
    this.setData({ inputMessage: e.detail.value });
  },
  

  // 发送消息
  sendMessage() {
    const userMessage = this.data.inputMessage.trim();
    if (!userMessage) {
      wx.showToast({ title: '输入不能为空', icon: 'none' });
      return;
    }
  
    const newMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
      image: null,
    };
  
    this.setData({
      messages: [...this.data.messages, newMessage],
      inputMessage: '',
      scrollToMessage: `msg-${newMessage.id}`,
    });
  
    chatCollection.add({
      data: newMessage,
      success: (res) => console.log('用户消息保存成功', res),
      fail: (err) => console.error('用户消息保存失败', err),
    });
  
    this.sendToServer(userMessage);
  }
  ,
  

  // 调用服务器接口
  sendToServer(text) {
    wx.request({
      url: 'http://127.0.0.1:80/generate-image',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
      },
      data: { text },
      success: (res) => {
        if (res.statusCode === 200 && res.data.img_url) {
          const aiMessage = {
            id: Date.now(),
            type: 'ai',
            content: '', // AI 的回复内容可填空，主要是图片消息
            timestamp: new Date(),
            image: res.data.img_url,
          };
  
          // 插入到云数据库
          chatCollection.add({
            data: aiMessage,
            success: (res) => {
              console.log('AI 消息保存成功', res);
            },
            fail: (err) => {
              console.error('AI 消息保存失败', err);
            },
          });
  
          // 更新到消息列表
          this.setData({
            messages: [...this.data.messages, aiMessage],
            scrollToMessage: `msg-${aiMessage.id}`,
          });
        } else {
          wx.showToast({ title: '服务器错误', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        console.error(err);
      },
    });
  },
  

  // 保存消息到数据库
  saveMessageToDatabase(message) {
    chatCollection.add({
      data: message,
      success: (res) => {
        console.log('消息保存到数据库成功', res);
      },
      fail: (err) => {
        console.error('消息保存失败', err);
      },
    });
  },

  // 加载历史记录
  loadChatHistory() {
    chatCollection.orderBy('timestamp', 'asc').get({
      success: (res) => {
        const messages = res.data.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp), // 确保时间戳为 `Date` 类型
        }));
        this.setData({ messages });
      },
      fail: (err) => {
        console.error('加载聊天记录失败', err);
      },
    });    
  },

  // 图片预览
  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: [src],
    });
  },

  // 清除缓存的对话记录
  clearChatHistory() {
    wx.cloud.callFunction({
      name: 'delate',
      data: {
        action: 'clearChatRecords',
      },
      success: () => {
        this.setData({ messages: [] });
        wx.showToast({ title: '对话记录已清除', icon: 'success' });
      },
      fail: (err) => {
        console.error('清除记录失败', err);
      },
    });
  },
  

  // 双击图片复制地址
  copyImageUrl(e) {
    const src = e.currentTarget.dataset.src;

    wx.setClipboardData({
      data: src,
      success: () => {
        wx.showToast({ title: '图片地址已复制', icon: 'success' });
      },
    });
  },
});
