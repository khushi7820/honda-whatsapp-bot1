import * as chatController from './backend/controllers/chatController.js';
console.log('Exports:', Object.keys(chatController));
if (chatController.verifyWebhook) {
    console.log('✅ verifyWebhook found');
} else {
    console.log('❌ verifyWebhook NOT found');
}
if (chatController.handleWebhook) {
    console.log('✅ handleWebhook found');
} else {
    console.log('❌ handleWebhook NOT found');
}
