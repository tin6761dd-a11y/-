(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdPageSamples = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PHONE = '請填入電話';
  var EMAIL = '請填入電子郵件';
  var ADDRESS = '請填入地址';
  var BLUE = '#1d4ed8';

  var contact = {
    phone: PHONE,
    email: EMAIL,
    address: ADDRESS,
    contact: '歡迎來電或來信洽詢維修、保養與設備買賣。' + PHONE + '／' + EMAIL,
    ctaLink: '#contact',
    customPrimary: BLUE,
    style: 'professional-blue',
    brandName: '益芳封口機',
    images: ''
  };

  function eventDateIso() {
    var d = new Date();
    d.setDate(d.getDate() + 28);
    d.setHours(14, 0, 0, 0);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T14:00';
  }

  var samples = {
    promo: Object.assign({}, contact, {
      productName: '益芳桌上型封口機',
      tagline: '飲料店的可靠夥伴，封口穩定、操作簡單',
      description:
        '益芳封口機專注封口機、果糖機及相關飲料設備的買賣與維修。這款桌上型封口機適合手搖飲、茶飲與外帶店使用，封口平整、操作直覺，買了之後也有維修與零件支援，讓出杯更安心。',
      features: [
        '適用常見飲料杯徑，封口平整不易滲漏',
        '結構耐用，適合店面高頻率使用',
        '零件充足，維修與保養可後續支援',
        '購機可安排基礎操作教學',
        '可一併詢價果糖機等相關設備'
      ].join('\n'),
      price: 'NT$ 請填入售價',
      originalPrice: '',
      offer: '新機購買可安排基礎安裝與操作說明（詳情請洽詢）',
      ctaText: '立即洽詢購機',
      eventDate: '',
      eventLocation: ''
    }),
    service: Object.assign({}, contact, {
      productName: '封口機・果糖機 專業維修與買賣',
      tagline: '維修、保養、買賣，讓設備穩定出杯',
      description:
        '益芳封口機提供封口機、果糖機及相關飲料設備的維修與買賣服務。無論是封口不穩、加熱異常、果糖定量不準，或是想添購新機、評估中古設備，我們都能協助檢測、說明與後續處理，幫助店家減少停機時間。',
      features: [
        '封口機故障檢修與零件更換',
        '果糖機定量校正與定期保養',
        '設備健診，降低旺季臨時停機風險',
        '新機與中古設備買賣建議',
        '操作教學與日常保養指導'
      ].join('\n'),
      price: '',
      originalPrice: '',
      offer: '首次送修可先檢查評估（實際費用依故障情況報價）',
      ctaText: '預約維修評估',
      eventDate: '',
      eventLocation: ''
    }),
    event: Object.assign({}, contact, {
      productName: '設備健診優惠月',
      tagline: '封口機、果糖機免費基礎健診，及早保養更安心',
      description:
        '為協助飲料店在忙碌檔期前做好準備，益芳封口機舉辦設備健診優惠活動。歡迎預約檢查您的封口機與果糖機，及早發現耗損零件與潛在故障，避免臨時停機影響出杯。活動期間亦可諮詢購機與保養方案。',
      features: [
        '免費基礎健診與狀況說明',
        '常用耗材與零件優惠（數量有限，詳情請洽詢）',
        '現場評估維修與保養方案',
        '購機諮詢與機型建議',
        '日常保養小撇步說明'
      ].join('\n'),
      price: '',
      originalPrice: '',
      offer: '活動期間預約健診，保養項目另享優惠（詳情請洽詢）',
      ctaText: '預約活動名額',
      eventDate: eventDateIso(),
      eventLocation: '請填入活動地點'
    }),
    ecommerce: Object.assign({}, contact, {
      productName: '益芳手動封口機（通用杯徑）',
      tagline: '穩定封口、好保養，適合手搖飲與外帶茶飲',
      description:
        '這款手動封口機為茶飲、手搖飲與輕食外帶店設計，操作直覺、封口平整。益芳同時提供後續零件與維修支援，設備買了之後也有人顧。如需搭配果糖機或其他相關設備，也可一併詢價。',
      features: [
        '適用常見飲料杯徑（實際規格請先確認）',
        '加熱均勻，封膜平整不易滲漏',
        '機身穩固，適合店面長時間使用',
        '耗材與零件可後續補給',
        '購機可諮詢操作說明與維修支援'
      ].join('\n'),
      price: 'NT$ 請填入售價',
      originalPrice: 'NT$ 請填入原價',
      offer: '購機享基礎教學，維修支援可洽詢',
      ctaText: '立即詢價',
      eventDate: '',
      eventLocation: ''
    })
  };

  function forTemplate(templateId) {
    var key = samples[templateId] ? templateId : 'service';
    var copy = Object.assign({}, samples[key]);
    if (key === 'event') copy.eventDate = eventDateIso();
    return copy;
  }

  return {
    DEFAULT_TEMPLATE: 'service',
    DEFAULT_STYLE: 'professional-blue',
    DEFAULT_PRIMARY: BLUE,
    BRAND: '益芳封口機',
    samples: samples,
    forTemplate: forTemplate
  };
});
