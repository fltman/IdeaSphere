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

    document.getElementById('saveIdea').addEventListener('click', function() {
        const ideaInput = document.getElementById('ideaInput');
        const ideaText = ideaInput.value.trim();
        console.log('Save idea clicked:', { ideaText, position: pendingIdeaPosition });
        
        if (ideaText && pendingIdeaPosition) {
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

    combineIdeasBtn.addEventListener('click', function() {
        if (ideaManager.isSelectMode) {
            if (ideaManager.selectedIdeas.length === 2) {
                const idea1 = ideaManager.selectedIdeas[0];
                const idea2 = ideaManager.selectedIdeas[1];
                
                idea1.element.classList.add('generating');
                idea2.element.classList.add('generating');
                
                fetch('/generate-ideas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        idea: `Combine these two ideas: 1. ${idea1.text} 2. ${idea2.text}`
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const combinedIdeas = JSON.parse(data.data).ideas;
                        const x1 = parseInt(idea1.element.style.left);
                        const y1 = parseInt(idea1.element.style.top);
                        const x2 = parseInt(idea2.element.style.left);
                        const y2 = parseInt(idea2.element.style.top);
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;
                        
                        const newIdea = ideaManager.addIdea(midX, midY, combinedIdeas[0].text, false, true);
                        ideaManager.connectIdeas(idea1, newIdea);
                        ideaManager.connectIdeas(idea2, newIdea);
                    }
                })
                .finally(() => {
                    idea1.element.classList.remove('generating');
                    idea2.element.classList.remove('generating');
                });
            }
            ideaManager.exitSelectMode();
            combineIdeasBtn.textContent = 'Kombinera idéer';
            combineIdeasBtn.classList.remove('btn-secondary');
            combineIdeasBtn.classList.add('btn-outline-primary');
        } else {
            ideaManager.enterSelectMode();
            combineIdeasBtn.textContent = 'Avsluta val';
            combineIdeasBtn.classList.remove('btn-outline-primary');
            combineIdeasBtn.classList.add('btn-secondary');
        }
    });

    startTimerBtn.addEventListener('click', function() {
        if (ideaManager.timer) {
            ideaManager.stopTimer();
            startTimerBtn.textContent = 'Start Timer';
            startTimerBtn.classList.remove('btn-success');
            startTimerBtn.classList.add('btn-outline-success');
            pauseTimerBtn.disabled = true;
        } else {
            const seconds = parseInt(timerInput.value);
            if (seconds > 0) {
                ideaManager.setTimerDuration(seconds);
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
        if (value > 3600) this.value = 3600;
    });
});
