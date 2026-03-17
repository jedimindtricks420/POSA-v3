// Диагностический скрипт для проверки элементов удаления аккаунта
console.log('=== Account Deletion Elements Check ===');

const deleteBtn = document.getElementById('deleteAccountBtn');
const deleteModal = document.getElementById('deleteModal');
const cancelBtn = document.getElementById('cancelDelete');
const confirmBtn = document.getElementById('confirmDelete');

console.log('Delete Button:', deleteBtn ? '✅ Found' : '❌ Not found');
console.log('Delete Modal:', deleteModal ? '✅ Found' : '❌ Not found');
console.log('Cancel Button:', cancelBtn ? '✅ Found' : '❌ Not found');
console.log('Confirm Button:', confirmBtn ? '✅ Found' : '❌ Not found');

if (deleteBtn) {
    console.log('Adding test click handler to delete button...');
    deleteBtn.addEventListener('click', () => {
        console.log('Delete button clicked!');
        if (deleteModal) {
            console.log('Opening modal...');
            deleteModal.classList.remove('hidden');
            deleteModal.classList.add('flex');
            console.log('Modal classes:', deleteModal.className);
        } else {
            console.error('Modal not found!');
        }
    });
    console.log('✅ Click handler added');
} else {
    console.error('❌ Cannot add click handler - button not found');
}

console.log('=== Check Complete ===');
