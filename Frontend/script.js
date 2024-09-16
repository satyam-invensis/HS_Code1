document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('predictionForm');
    const resultContainer = document.getElementById('resultContainer');
    const loading = document.getElementById('loading');
    const backButton = document.getElementById('backButton');

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const formData = new FormData(form);

            loading.style.display = 'block'; // Show loading indicator

            fetch('http://localhost:3000/predict', {
                method: 'POST',
                body: new URLSearchParams(formData)
            })
            .then(response => response.text()) // Expect HTML response
            .then(html => {
                loading.style.display = 'none'; // Hide loading indicator
                resultContainer.innerHTML = html; // Display the result HTML
            })
            .catch(error => {
                loading.style.display = 'none'; // Hide loading indicator
                console.error('Error:', error);
                resultContainer.innerHTML = '<p>There was an error processing your request.</p>';
            });
        });
    } else {
        console.error('Form with id "predictionForm" not found.');
    }
});
