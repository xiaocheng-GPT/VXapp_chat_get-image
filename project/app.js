App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云开发功能');
    } else {
      wx.cloud.init({
        env: 'sql-xc-8ge64e7i6748d53d', // 替换为你的云开发环境ID
        traceUser: true,
      });
    }
  }
});