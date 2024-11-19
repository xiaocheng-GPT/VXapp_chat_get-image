Page({
  data: {
    messages: [],        // 消息列表
    inputMessage: '',    // 用户输入的消息
    scrollToMessage: '', // 滚动到的消息
  },

  // 页面加载时恢复历史记录
  onLoad() {
    const savedMessages = wx.getStorageSync('chatHistory') || [];
    this.setData({ messages: savedMessages });
  },

  // 输入框监听
  onInput(e) {
    this.setData({
      inputMessage: e.detail.value
    });
  },

  // 发送消息
  sendMessage() {
    const userMessage = this.data.inputMessage.trim();
    if (!userMessage) {
      wx.showToast({ title: '输入不能为空', icon: 'none' });
      return;
    }

    // 添加用户消息到消息列表
    const newMessage = {
      id: Date.now(),
      type: 'user',
      text: userMessage
    };

    this.setData({
      messages: [...this.data.messages, newMessage],
      inputMessage: '', // 清空输入框
      scrollToMessage: `msg-${newMessage.id}`
    });

    // 保存消息记录
    this.saveHistory();

    // 发送请求到服务器
    this.sendToServer(userMessage);
  },

  // 调用服务器接口
  sendToServer(text) {
    wx.request({
      url: 'http://127.0.0.1:5000/generate_image', // 本地服务器地址
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: { text }, // 简洁写法
      success: (res) => {
        if (res.statusCode === 200 && res.data.image_url) {
          const imageUrl = res.data.image_url;

          // 将返回的图片添加到消息列表
          const newMessage = {
            id: Date.now(),
            type: 'ai',
            image: imageUrl
          };

          this.setData({
            messages: [...this.data.messages, newMessage],
            scrollToMessage: `msg-${newMessage.id}`
          });

          // 保存消息记录
          this.saveHistory();
        } else {
          wx.showToast({ title: '服务器错误', icon: 'none' });
          console.error("服务器返回错误：", res.data);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        console.error("请求失败：", err);
      }
    });
  },

  // 保存历史记录
  saveHistory() {
    wx.setStorageSync('chatHistory', this.data.messages);
  },

  // 图片预览
  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: [src]
    });
  },

  // 双击图片复制地址
  copyImageUrl(e) {
    const src = e.currentTarget.dataset.src;

    wx.setClipboardData({
      data: src,
      success: () => {
        wx.showToast({ title: '图片地址已复制', icon: 'success' });
      }
    });
  }
});
