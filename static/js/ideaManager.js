class IdeaManager {
    constructor(workspaceId) {
        this.workspace = document.getElementById(workspaceId);
        this.ideas = [];
        this.connections = [];
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.selectedIdea = null;
        this.isSelectMode = false;
        this.selectedIdeas = [];
        this.activeTooltip = null;
        this.isMergeMode = false;
        this.mergeIdeas = [];
        this.generatedIdeas = [];
        this.maxHistoryItems = 10;
        this.timer = null;
        this.timerDuration = 5 * 60 * 1000;
        this.remainingTime = this.timerDuration;
        this.isTimerPaused = false;
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.setupEventListeners();
        this.updateCountdownDisplay();
    }

    updateCountdownDisplay() {
        if (!this.countdownDisplay) return;
        
        if (!this.timer) {
            this.countdownDisplay.textContent = '';
            return;
        }
        
        const minutes = Math.floor(this.remainingTime / 60000);
        const seconds = Math.floor((this.remainingTime % 60000) / 1000);
        this.countdownDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    startTimer() {
        if (this.timer) return;
        
        const startTime = Date.now() - (this.timerDuration - this.remainingTime);
        this.timer = setInterval(() => {
            if (!this.isTimerPaused) {
                const elapsedTime = Date.now() - startTime;
                this.remainingTime = Math.max(0, this.timerDuration - elapsedTime);
                this.updateCountdownDisplay();
                
                if (this.remainingTime === 0) {
                    this.handleTimerExpired();
                }
            }
        }, 100);
        
        this.updateCountdownDisplay();
    }

    pauseTimer() {
        this.isTimerPaused = true;
    }

    resumeTimer() {
        this.isTimerPaused = false;
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.updateCountdownDisplay();
        }
    }

    setTimerDuration(minutes) {
        this.timerDuration = minutes * 60 * 1000;
        this.remainingTime = this.timerDuration;
        this.updateCountdownDisplay();
    }

    async handleTimerExpired() {
        this.stopTimer();
        
        if (this.ideas.length >= 2) {
            const shuffled = [...this.ideas].sort(() => 0.5 - Math.random());
            const [idea1, idea2] = shuffled.slice(0, 2);
            
            idea1.element.classList.add('generating');
            idea2.element.classList.add('generating');
            
            try {
                const response = await fetch('/generate-ideas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        idea: `Combine these two ideas: 1. ${idea1.text} 2. ${idea2.text}`
                    })
                });

                const data = await response.json();
                if (data.success) {
                    const combinedIdeas = JSON.parse(data.data).ideas;
                    const x1 = parseInt(idea1.element.style.left);
                    const y1 = parseInt(idea1.element.style.top);
                    const x2 = parseInt(idea2.element.style.left);
                    const y2 = parseInt(idea2.element.style.top);
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    
                    const newIdea = this.addIdea(midX, midY, combinedIdeas[0].text);
                    this.connectIdeas(idea1, newIdea);
                    this.connectIdeas(idea2, newIdea);
                }
            } finally {
                idea1.element.classList.remove('generating');
                idea2.element.classList.remove('generating');
            }
        }
        
        this.remainingTime = this.timerDuration;
        this.startTimer();
    }

    // ... rest of the IdeaManager class implementation ...
    [Previous implementation continues unchanged]
