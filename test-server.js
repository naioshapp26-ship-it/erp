const express = require('express');
const app = express();

// محاكاة اختبار سريع للـ auth API
app.use(express.json());

const authRoutes = require('./auth-api');
app.use('/api/auth', authRoutes);

const PORT = 4000;

app.listen(PORT, () => {
    console.log(`🧪 خادم الاختبار يعمل على http://localhost:${PORT}`);
    console.log('\n📋 اختبارات متاحة:');
    console.log('   POST http://localhost:4000/api/auth/login');
    console.log('   GET  http://localhost:4000/api/auth/verify');
    console.log('\n💡 استخدم curl أو Postman للاختبار\n');
});
