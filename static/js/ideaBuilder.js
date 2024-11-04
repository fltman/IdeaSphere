document.addEventListener('DOMContentLoaded', function() {
    const workspace = document.getElementById('idea-workspace');
    const canvas = document.getElementById('connections-canvas');
    const canvasManager = new CanvasManager('connections-canvas');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const clearCanvasBtn = document.getElementById('clearCanvas');
    const combineIdeasBtn = document.getElementById('combineIdeasBtn');
    const startTimerBtn = document.getElementById('startTimer');
    const pauseTimerBtn = document.getElementById('pauseTimer');
    const timerInput = document.getElementById('timerInput');
    const ideasList = document.getElementById('ideas-list');
    let pendingIdeaPosition = null;

    workspace.addEventListener('click', function(e) {
        if (e.target === workspace || e.target === canvas) {
            const rect = workspace.getBoundingClientRect();
            const x = e.clientX - rect.left + workspace.scrollLeft;
            const y = e.clientY - rect.top + workspace.scrollTop;
            
            pendingIdeaPosition = { x, y };
            ideaModal.show();
            document.getElementById('ideaInput').focus();
        }
    });

    document.getElementById('ideaInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('saveIdea').click();
        }
    });

    document.getElementById('saveIdea').addEventListener('click', function() {
        const ideaInput = document.getElementById('ideaInput');
        const ideaText = ideaInput.value.trim();
        
        if (ideaText && pendingIdeaPosition) {
            const newIdea = canvasManager.addIdea(
                pendingIdeaPosition.x,
                pendingIdeaPosition.y,
                ideaText
            );
            
            // Add to recent ideas list
            const li = document.createElement('li');
            li.textContent = ideaText;
            li.addEventListener('click', () => {
                const workspaceRect = workspace.getBoundingClientRect();
                const x = workspaceRect.width / 2 + workspace.scrollLeft;
                const y = workspaceRect.height / 2 + workspace.scrollTop;
                canvasManager.addIdea(x, y, ideaText);
            });
            ideasList.insertBefore(li, ideasList.firstChild);
            
            ideaInput.value = '';
            ideaModal.hide();
            pendingIdeaPosition = null;
        }
    });

    clearCanvasBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the workspace? This cannot be undone.')) {
            canvasManager.ideas = [];
            canvasManager.connections = [];
            canvasManager.render();
            ideasList.innerHTML = '';
        }
    });

    let selectedIdeas = [];
    combineIdeasBtn.addEventListener('click', function() {
        if (selectedIdeas.length === 2) {
            const idea1 = selectedIdeas[0];
            const idea2 = selectedIdeas[1];
            
            fetch('/generate-ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    idea: `Combine these ideas: 1. ${idea1.text} 2. ${idea2.text}`
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const combinedIdeas = JSON.parse(data.data).ideas;
                    const midX = (idea1.x + idea2.x) / 2;
                    const midY = (idea1.y + idea2.y) / 2;
                    
                    const newIdea = canvasManager.addIdea(
                        midX, midY,
                        combinedIdeas[0].text,
                        false,
                        true
                    );
                    
                    canvasManager.connectIdeas(idea1, newIdea);
                    canvasManager.connectIdeas(idea2, newIdea);
                    
                    // Add to recent ideas list
                    const li = document.createElement('li');
                    li.textContent = combinedIdeas[0].text;
                    li.addEventListener('click', () => {
                        const workspaceRect = workspace.getBoundingClientRect();
                        const x = workspaceRect.width / 2 + workspace.scrollLeft;
                        const y = workspaceRect.height / 2 + workspace.scrollTop;
                        canvasManager.addIdea(x, y, combinedIdeas[0].text, false, true);
                    });
                    ideasList.insertBefore(li, ideasList.firstChild);
                }
            })
            .catch(console.error)
            .finally(() => {
                selectedIdeas = [];
                canvasManager.render();
            });
        }
    });

    // Timer functionality
    startTimerBtn.addEventListener('click', function() {
        const minutes = parseInt(timerInput.value) || 5;
        let timeLeft = minutes * 60;
        const countdownDisplay = document.getElementById('countdownDisplay');
        
        if (this.dataset.state === 'stopped') {
            const timer = setInterval(() => {
                if (!document.hidden && this.dataset.state === 'running') {
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    countdownDisplay.textContent = 
                        `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        this.textContent = 'Start Timer';
                        this.dataset.state = 'stopped';
                        pauseTimerBtn.disabled = true;
                        alert('Time is up!');
                    }
                    timeLeft--;
                }
            }, 1000);
            
            this.textContent = 'Stop Timer';
            this.dataset.state = 'running';
            pauseTimerBtn.disabled = false;
        } else {
            this.textContent = 'Start Timer';
            this.dataset.state = 'stopped';
            pauseTimerBtn.disabled = true;
            countdownDisplay.textContent = '';
        }
    });

    pauseTimerBtn.addEventListener('click', function() {
        const startBtn = document.getElementById('startTimer');
        if (startBtn.dataset.state === 'running') {
            startBtn.dataset.state = 'paused';
            this.textContent = 'Resume';
        } else {
            startBtn.dataset.state = 'running';
            this.textContent = 'Pause';
        }
    });

    timerInput.addEventListener('input', function() {
        let value = parseInt(this.value) || 5;
        value = Math.max(1, Math.min(60, value));
        this.value = value;
    });
});
