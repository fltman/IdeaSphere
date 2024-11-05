document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const ideaManager = new IdeaManager('idea-workspace');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const clearCanvasBtn = document.getElementById('clearCanvas');
    const combineIdeasBtn = document.getElementById('combineIdeasBtn');
    const startTimerBtn = document.getElementById('startTimer');
    const pauseTimerBtn = document.getElementById('pauseTimer');
    const timerInput = document.getElementById('timerInput');
    let pendingIdeaPosition = null;

    document.addEventListener('workspace-click', function(e) {
        console.log('Workspace click event received:', e.detail);
        pendingIdeaPosition = { x: e.detail.x, y: e.detail.y };
        ideaModal.show();
    });

    document.getElementById('saveIdea').addEventListener('click', async function() {
        const ideaInput = document.getElementById('ideaInput');
        const inputText = ideaInput.value.trim();
        console.log('Save idea clicked:', { inputText, position: pendingIdeaPosition });
        
        if (inputText && pendingIdeaPosition) {
            // Check if input is a URL
            let ideaText = inputText;
            if (inputText.startsWith('http')) {
                try {
                    const saveButton = document.getElementById('saveIdea');
                    const originalText = saveButton.textContent;
                    saveButton.textContent = 'Hämtar innehåll...';
                    saveButton.disabled = true;

                    const response = await fetch('/fetch-url-content', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ url: inputText })
                    });

                    if (!response.ok) throw new Error('Failed to fetch URL content');
                    
                    const data = await response.json();
                    if (data.content) {
                        ideaText = data.content;
                    }
                } catch (error) {
                    console.error('Error fetching URL:', error);
                    // Keep original URL as text if fetch fails
                } finally {
                    const saveButton = document.getElementById('saveIdea');
                    saveButton.textContent = 'Spara';
                    saveButton.disabled = false;
                }
            }

            const newIdea = ideaManager.addIdea(
                pendingIdeaPosition.x,
                pendingIdeaPosition.y,
                ideaText
            );
            console.log('New idea created:', newIdea);
            
            ideaInput.value = '';
            ideaModal.hide();
            pendingIdeaPosition = null;
        } else {
            console.warn('Cannot save idea: missing text or position');
        }
    });

    clearCanvasBtn.addEventListener('click', function() {
        console.log('Clearing workspace');
        ideaManager.clearWorkspace();
    });


    startTimerBtn.addEventListener('click', function() {
        if (ideaManager.timer) {
            ideaManager.stopTimer();
            startTimerBtn.textContent = 'Start Timer';
            startTimerBtn.classList.remove('btn-success');
            startTimerBtn.classList.add('btn-outline-success');
            pauseTimerBtn.disabled = true;
        } else {
            const minutes = parseInt(timerInput.value);
            if (minutes > 0) {
                ideaManager.setTimerDuration(minutes);
                ideaManager.startTimer();
                startTimerBtn.textContent = 'Stop Timer';
                startTimerBtn.classList.remove('btn-outline-success');
                startTimerBtn.classList.add('btn-success');
                pauseTimerBtn.disabled = false;
            }
        }
    });

    pauseTimerBtn.addEventListener('click', function() {
        if (ideaManager.isTimerPaused) {
            ideaManager.resumeTimer();
            pauseTimerBtn.textContent = 'Pause';
            pauseTimerBtn.classList.remove('btn-warning');
            pauseTimerBtn.classList.add('btn-outline-warning');
        } else {
            ideaManager.pauseTimer();
            pauseTimerBtn.textContent = 'Resume';
            pauseTimerBtn.classList.remove('btn-outline-warning');
            pauseTimerBtn.classList.add('btn-warning');
        }
    });

    timerInput.addEventListener('change', function() {
        const value = parseInt(this.value);
        if (value < 1) this.value = 1;
        if (value > 60) this.value = 60;
    });
});
