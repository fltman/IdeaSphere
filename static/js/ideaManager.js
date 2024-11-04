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

    setupEventListeners() {
        this.workspace.addEventListener('click', (e) => {
            const event = new CustomEvent('workspace-click', {
                detail: {
                    x: e.clientX - this.workspace.getBoundingClientRect().left + this.workspace.scrollLeft,
                    y: e.clientY - this.workspace.getBoundingClientRect().top + this.workspace.scrollTop
                }
            });
            document.dispatchEvent(event);
        });
    }

    addIdea(x, y, text, isAIGenerated = false) {
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'}`;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        ideaBall.textContent = text;
        ideaBall.draggable = true;

        // Add generate button
        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-sm btn-success generate-btn';
        generateBtn.innerHTML = '+';
        generateBtn.style.position = 'absolute';
        generateBtn.style.right = '-10px';
        generateBtn.style.top = '-10px';
        ideaBall.appendChild(generateBtn);

        // Add info button
        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn btn-sm btn-info info-btn';
        infoBtn.innerHTML = 'i';
        infoBtn.style.position = 'absolute';
        infoBtn.style.left = '-10px';
        infoBtn.style.top = '-10px';
        ideaBall.appendChild(infoBtn);

        // Add merge button
        const mergeBtn = document.createElement('button');
        mergeBtn.className = 'btn btn-sm btn-warning merge-btn';
        mergeBtn.innerHTML = '⚡';
        mergeBtn.style.position = 'absolute';
        mergeBtn.style.right = '-10px';
        mergeBtn.style.bottom = '-10px';
        ideaBall.appendChild(mergeBtn);

        this.setupDragListeners(ideaBall);
        
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text: text };
        this.ideas.push(idea);
        this.addToHistory(text, true);
        return idea;
    }

    setupDragListeners(ideaBall) {
        ideaBall.addEventListener('dragstart', (e) => {
            if (!this.isSelectMode) {
                this.isDragging = true;
                this.selectedIdea = ideaBall;
                const rect = ideaBall.getBoundingClientRect();
                this.dragStartPos = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                const dragImage = document.createElement('div');
                dragImage.style.width = '0';
                dragImage.style.height = '0';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                setTimeout(() => document.body.removeChild(dragImage), 0);
            }
        });

        ideaBall.addEventListener('drag', (e) => {
            if (this.isSelectMode || e.clientX === 0 && e.clientY === 0) return;
            
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left + this.workspace.scrollLeft - this.dragStartPos.x;
            const y = e.clientY - rect.top + this.workspace.scrollTop - this.dragStartPos.y;
            
            const minPadding = 120;
            const boundedX = Math.max(minPadding, Math.min(x, this.workspace.clientWidth - minPadding));
            const boundedY = Math.max(minPadding, Math.min(y, this.workspace.clientHeight - minPadding));
            
            ideaBall.style.transform = 'translate(0, 0)';
            ideaBall.style.left = `${boundedX}px`;
            ideaBall.style.top = `${boundedY}px`;
        });
    }

    connectIdeas(idea1, idea2) {
        const connection = { from: idea1, to: idea2 };
        this.connections.push(connection);
    }

    clearWorkspace() {
        while (this.workspace.firstChild) {
            this.workspace.removeChild(this.workspace.firstChild);
        }
        this.ideas = [];
        this.connections = [];
    }

    addToHistory(text, isGenerated = true) {
        if (isGenerated) {
            this.generatedIdeas.unshift(text);
            if (this.generatedIdeas.length > this.maxHistoryItems) {
                this.generatedIdeas.pop();
            }
            this.updateHistoryList();
        }
    }

    updateHistoryList() {
        const list = document.getElementById('ideas-list');
        list.innerHTML = '';
        this.generatedIdeas.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
    }

    enterSelectMode() {
        this.isSelectMode = true;
        this.selectedIdeas = [];
    }

    exitSelectMode() {
        this.isSelectMode = false;
        this.selectedIdeas.forEach(idea => {
            idea.element.classList.remove('selected');
        });
        this.selectedIdeas = [];
    }

    handleIdeaSelection(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        const index = this.selectedIdeas.indexOf(idea);
        
        if (index === -1) {
            if (this.selectedIdeas.length < 2) {
                ideaBall.classList.add('selected');
                this.selectedIdeas.push(idea);
            }
        } else {
            ideaBall.classList.remove('selected');
            this.selectedIdeas.splice(index, 1);
        }
    }
}
