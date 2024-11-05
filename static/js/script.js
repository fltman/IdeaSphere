// Improved URL check function
function isValidURL(string) {
    // Remove @ if it starts with it
    string = string.replace(/^@/, '');
    
    try {
        // If no protocol specified, add https://
        if (!string.match(/^https?:\/\//i)) {
            string = 'https://' + string;
        }
        new URL(string);
        return string; // Return the cleaned URL
    } catch (_) {
        return false;
    }
}

// Modify your existing save idea handler
async function handleIdeaSave() {
    const ideaInput = document.getElementById('ideaInput');
    const inputText = ideaInput.value.trim();
    
    let ideaContent = inputText;
    const cleanedUrl = isValidURL(inputText);
    
    if (cleanedUrl) {
        try {
            console.log('Fetching content for URL:', cleanedUrl); // Debug log
            
            // Show loading state
            const saveButton = document.getElementById('saveIdea');
            const originalText = saveButton.textContent;
            saveButton.textContent = 'Hämtar innehåll...';
            saveButton.disabled = true;
            
            const response = await fetch('/fetch-url-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: cleanedUrl })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received data:', data); // Debug log
            
            if (data.content) {
                ideaContent = data.content;
            } else {
                throw new Error('No content received from server');
            }
            
        } catch (error) {
            console.error('Error fetching URL:', error);
            alert('Kunde inte hämta innehåll från URL:en. Använder URL:en som text istället.');
        } finally {
            const saveButton = document.getElementById('saveIdea');
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }
    }
    
    // Only create the idea ball after we have the content
    createIdeaBall(ideaContent);
    
    // Close modal and clear input
    const modal = bootstrap.Modal.getInstance(document.getElementById('ideaModal'));
    modal.hide();
    ideaInput.value = '';
}

// Make sure to update your event listener
document.getElementById('saveIdea').addEventListener('click', handleIdeaSave); 