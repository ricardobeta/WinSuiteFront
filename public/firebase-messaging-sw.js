importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDbbvMDSz11Ln6skNGRfvwkfjhxmkagA8g',
  authDomain: 'wa-marketing-ea461.firebaseapp.com',
  projectId: 'wa-marketing-ea461',
  storageBucket: 'wa-marketing-ea461.firebasestorage.app',
  messagingSenderId: '1098700113511',
  appId: '1:1098700113511:web:ca5e38d15972a3c016f6c2'
});

firebase.messaging();

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification?.data?.FCM_MSG?.data?.link || '/workspace/dashboard';
  event.waitUntil(clients.openWindow(link));
});
