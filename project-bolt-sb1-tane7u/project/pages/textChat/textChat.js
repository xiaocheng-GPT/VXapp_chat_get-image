
updateMessages(content) {
  const MAX_MESSAGE_LENGTH = 500;  // 设置最大消息长度

  // 创建一个新的AI消息对象
  const newMessage = {
    id: Date.now(),
    type: 'ai',
    text: '' // 初始化文本为空，待逐字显示
  };

  // 将AI消息加入当前消息列表
  this.setData({
    messages: [...this.data.messages, newMessage],
    scrollToMessage: `msg-${newMessage.id}`
  });

  // 逐字显示的实现
  let index = 0;
  const interval = setInterval(() => {
    newMessage.text += content.charAt(index); // 逐字添加文本
    this.setData({
      messages: [...this.data.messages] // 更新消息内容
    });

    index++;
    if (index === content.length) {
      clearInterval(interval); // 如果消息已显示完，停止定时器

      // 保存AI消息到数据库
      chatCollection.add({
        data: newMessage,
        success: res => console.log('AI消息保存成功', res),
        fail: err => console.error('AI消息保存失败', err)
      });

      wx.setStorageSync('messages', this.data.messages);
      this.autoScroll(); // 自动滚动到最新消息
    }
  }, 50); // 每50毫秒显示一个字符

  // 获取最近一条用户消息和AI消息
  const lastUserMessage = this.data.messages.find(message => message.type === 'user');
  const lastAiMessage = {
    id: newMessage.id,
    type: 'ai',
    text: content
  };

  // 如果最近一条AI消息长度超过设定的最大长度，则只上传用户的最新消息
  if (lastAiMessage.text.length > MAX_MESSAGE_LENGTH) {
    console.log("消息过长，只上传用户问题");
    // 只保留用户消息
    const filteredMessages = [lastUserMessage];

    // 保存最新的用户消息到缓存
    wx.setStorageSync('messages', filteredMessages);
  } else {
    // 如果消息长度正常，保留最近一条用户消息和AI回复
    const filteredMessages = [lastUserMessage, lastAiMessage];

    // 保存最新的对话记录到缓存
    wx.setStorageSync('messages', filteredMessages);
  }

  this.autoScroll();
}
