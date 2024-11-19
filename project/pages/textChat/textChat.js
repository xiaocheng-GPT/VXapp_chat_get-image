Page({
  autoScroll() {
    // 滚动逻辑
  },

  data: {
    messages: [],
    inputMessage: '',
    scrollToMessage: '',
    access_token: "24.74792a560881c1e4c821e82497652e3b.2592000.1734058662.282335-116220525", // 原 access_token
    image_access_token: "24.9a401555e7596e31cb8b76a8c5bd41f8.2592000.1734073875.282335-116223774", // 新的 access_token 用于图片解析
    status: 0,
    retryInterval: null,  // 用于轮询查询任务状态的定时器
    maxRetries: 5,  // 最大重试次数
    retries: 0,  // 当前重试次数
    chosenImagePath: '',  // 保存选择的图片路径
    cachedTaskId: null, // 缓存 task_id
    question: ""  // 动态变化的提问内容
  },

  onInput(e) {
    this.setData({
      inputMessage: e.detail.value
    });
  },

  sendMessage() {
    if (!this.data.inputMessage.trim()) {
      wx.showToast({
        title: '消息不能为空',
        icon: 'error'
      });
      return;
    }

    const newMessage = {
      id: Date.now(),
      type: 'user',
      text: this.data.inputMessage
    };

    this.setData({
      messages: [...this.data.messages, newMessage],
      inputMessage: '',
      scrollToMessage: `msg-${newMessage.id}`
    });

    // 保存对话记录
    wx.setStorageSync('messages', this.data.messages);

    this.autoScroll();

    // 判断是否为图像理解的提问
    if (this.isImageRequest(newMessage.text)) {
      if (this.data.cachedTaskId) {
        // 如果缓存中有 task_id，直接提问图像问题
        this.sendImageQuestion(newMessage.text);
      } else {
        // 如果没有缓存的 task_id，选择图片进行分析
        this.chooseImage();
      }
    } else {
      this.sendRequest(newMessage.text); // 向文本大模型提问
    }
  },

  isImageRequest(text) {
    // 检测输入的文本是否包含特定的图像理解请求关键字
    const imageRequestKeywords = ["这张图片", "这个图片", "图片中的"];
    return imageRequestKeywords.some(keyword => text.includes(keyword));
  },

  sendRequest(content) {
    let access_token = this.data.access_token;

    // 获取最近的用户消息
    const lastUserMessage = {
      role: 'user',
      content: content
    };

    // 获取最近的AI回复（如果存在）
    const lastAiMessage = this.data.messages.length > 0 && this.data.messages[this.data.messages.length - 1].type === 'ai' 
      ? {
        role: 'assistant',
        content: this.data.messages[this.data.messages.length - 1].text
      }
      : null; // 如果没有AI回复，则为空

    // 构建请求数据
    const dataToSend = {
      messages: [lastUserMessage, lastAiMessage].filter(Boolean) // 只保留有内容的消息（即非 null）
    };

    wx.showLoading({
      title: '加载中...',
    });

    this.setData({
      status: 1
    });

    wx.request({
      url: `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${access_token}`,
      method: "POST",
      header: {
        "Content-Type": "application/json"
      },
      data: dataToSend,
      success: (res) => {
        wx.hideLoading();
        console.log('AI 返回的完整响应:', res);  // 输出完整的返回内容以便分析
        let responseContent = res.data.result || res.data.data?.result;

        if (typeof responseContent !== 'string') {
          console.log('错误：AI返回的内容不符合预期', responseContent);
          return;
        }

        this.updateMessages(responseContent); // 更新消息
      },

      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '错误，请重试',
          icon: 'error'
        });
        this.setData({
          status: 0
        });
      }
    });
  },

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
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        const imagePath = res.tempFilePaths[0];  // 获取图片路径
  
        // 先展示选择的图片
        this.setData({
          chosenImagePath: imagePath  // 保存选择的图片路径
        });
  
        // 立即在用户消息中显示图片
        const newMessage = {
          id: Date.now(),
          type: 'user',  // 标记为用户消息
          image: imagePath  // 直接存储图片路径
        };
  
        this.setData({
          messages: [...this.data.messages, newMessage],
          scrollToMessage: `msg-${newMessage.id}`  // 滚动到最新消息
        });
  
        // 上传图片后立即回复“图片解析中，请稍后！”
        const processingMessage = {
          id: Date.now() + 1,  // 确保此消息ID唯一
          type: 'ai',  // 标记为AI回复
          text: '图片解析中，请稍后...'  // 提示消息
        };
  
        this.setData({
          messages: [...this.data.messages, processingMessage],
          scrollToMessage: `msg-${processingMessage.id}`  // 滚动到最新消息
        });
  
        // 获取文件的 Base64 编码
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: imagePath,
          encoding: 'base64',
          success: (readRes) => {
            const base64Data = readRes.data;  // 获取 Base64 编码
  
            // 准备发送给图像理解 API 的数据
            const access_token = this.data.image_access_token;  // 使用图片解析的 access_token
  
            // 向图像理解 API 提交请求
            wx.request({
              url: `https://aip.baidubce.com/rest/2.0/image-classify/v1/image-understanding/request?access_token=${access_token}`,
              method: 'POST',
              header: {
                'Content-Type': 'application/json',
              },
              data: {
                image: base64Data,  // 发送图片的 Base64 编码
                question: "这张图片里有什么？"  // 提问内容
              },
              success: (res) => {
                wx.hideLoading();
                console.log('图像理解 API 返回:', res);  // 输出图像理解 API 返回的结果
  
                if (res.data.result) {
                  const taskId = res.data.result.task_id;
                  this.setData({
                    cachedTaskId: taskId  // 缓存 task_id
                  });
  
                  // 开始轮询查询任务结果
                  this.pollForResult(taskId);
                } else {
                  wx.showToast({
                    title: '图像理解失败，请重试',
                    icon: 'error'
                  });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                wx.showToast({
                  title: '图片上传失败',
                  icon: 'error'
                });
              }
            });
          },
          fail: (err) => {
            console.error('读取文件失败:', err);
            wx.showToast({
              title: '读取图片失败',
              icon: 'error'
            });
          }
        });
      },
      fail: (err) => {
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },
  

  sendImageQuestion(question) {
    if (!this.data.cachedTaskId) return; // 确保 task_id 已缓存

    wx.showLoading({
      title: '正在分析图片...',
    });

    wx.request({
      url: `https://aip.baidubce.com/rest/2.0/image-classify/v1/image-understanding/get-result?access_token=${this.data.image_access_token}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
      },
      data: {
        task_id: this.data.cachedTaskId,
        question: question // 使用动态变化的提问内容
      },
      success: (res) => {
        wx.hideLoading();
        console.log('图片问题回答结果:', res);

        if (res.data.result && res.data.result.description) {
          const description = res.data.result.description;
          this.updateMessages(description);  // 更新图像分析结果
        } else {
          wx.showToast({
            title: '图像问题回答失败',
            icon: 'error'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '请求失败',
          icon: 'error'
        });
      }
    });
  },

  pollForResult(taskId) {
    // 开始轮询任务结果
    const maxRetries = this.data.maxRetries;
    let retries = 0;

    this.setData({
      retries: retries
    });

    const interval = setInterval(() => {
      if (retries >= maxRetries) {
        clearInterval(interval); // 超过最大重试次数时停止轮询
        wx.showToast({
          title: '分析超时，请重试',
          icon: 'error'
        });
        return;
      }

      // 查询任务结果
      wx.request({
        url: `https://aip.baidubce.com/rest/2.0/image-classify/v1/image-understanding/get-result?access_token=${this.data.image_access_token}`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
        },
        data: {
          task_id: taskId
        },
        success: (res) => {
          console.log('轮询获取结果:', res);

          if (res.data.result && res.data.result.description) {
            const description = res.data.result.description;
            clearInterval(interval); // 停止轮询

            // 更新图像理解结果
            this.setData({
              messages: [...this.data.messages, {
                id: Date.now(),
                type: 'ai',
                text: `图片分析结果：${description}`
              }],
              scrollToMessage: `msg-${Date.now()}`
            });

            wx.setStorageSync('messages', this.data.messages);
          } else if (res.data.result && res.data.result.ret_code === 1) {
            retries++;
            this.setData({ retries: retries });
          }
        },
        fail: (err) => {
          clearInterval(interval);
          wx.showToast({
            title: '获取结果失败',
            icon: 'error'
          });
        }
      });
    }, 5000);  // 每5秒查询一次，直到任务完成
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: [src]
    });
  },

  // 滚动到尾部
  autoScroll() {
    let that = this;
    wx.createSelectorQuery().select('#communication').boundingClientRect(function (rect) {
      wx.pageScrollTo({
        scrollTop: rect.height,
        duration: 300
      });
      that.setData({
        scrollTop: rect.height - that.data.scrollTop
      });
    }).exec();
  },

  // 清除缓存的对话记录
  clearChatHistory() {
    wx.removeStorageSync('messages'); // 清除缓存
    this.setData({
      messages: [] // 清空当前页面的消息列表
    });
    wx.showToast({
      title: '对话记录已清除',
      icon: 'success'
    });
  },

  onLoad: function (options) {
    let messages = wx.getStorageSync('messages');
    if (messages) {
      this.setData({
        messages
      });
    } else {
      this.setData({
        messages: []
      });
    }

    setTimeout(() => {
      this.autoScroll();
    }, 500);
  },
});