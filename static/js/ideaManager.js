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
        this.velocities = new Map();
        this.lastFrameTime = performance.now();
        this.animationFrame = null;
        this.tooltip = this.createTooltip();

        this.setupEventListeners();
        this.startPhysicsLoop();

        window.addEventListener('resize', () => {
            this.drawConnections();
        });
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
                    this.stopTimer();
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

    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.style.display = 'none';
        this.workspace.appendChild(tooltip);
        return tooltip;
    }

    showTooltip(ideaBall, text) {
        const rect = ideaBall.getBoundingClientRect();
        const workspaceRect = this.workspace.getBoundingClientRect();
        
        if (this.activeTooltip && this.activeTooltip.ideaBall === ideaBall) {
            this.hideTooltip();
            return;
        }
        
        this.hideTooltip();
        
        this.tooltip.textContent = text;
        this.tooltip.style.display = 'block';
        
        const tooltipX = rect.left - workspaceRect.left + rect.width + 10;
        const tooltipY = rect.top - workspaceRect.top;
        
        this.tooltip.style.left = `${tooltipX}px`;
        this.tooltip.style.top = `${tooltipY}px`;
        
        this.activeTooltip = { ideaBall, tooltip: this.tooltip };
        this.isPermanentTooltip = true;
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
            this.activeTooltip = null;
            this.isPermanentTooltip = false;
        }
    }

    setupEventListeners() {
        this.workspace.addEventListener('click', (e) => {
            if (e.target === this.workspace) {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft;
                const y = e.clientY - rect.top + this.workspace.scrollTop;
                
                const event = new CustomEvent('workspace-click', {
                    detail: { x, y }
                });
                document.dispatchEvent(event);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.workspace.contains(e.target)) {
                this.hideTooltip();
            }
        });
    }

    startPhysicsLoop() {
        const animate = () => {
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;

            this.updatePhysics(deltaTime);
            this.animationFrame = requestAnimationFrame(animate);
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    stopPhysicsLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    updatePhysics(deltaTime) {
        // Physics update logic remains the same...
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

                const idea = this.ideas.find(i => i.element === ideaBall);
                if (idea) this.velocities.set(idea, { x: 0, y: 0 });
            }
        });

        ideaBall.addEventListener('drag', (e) => {
            if (this.isSelectMode || (e.clientX === 0 && e.clientY === 0)) return;
            
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left - this.dragStartPos.x;
            const y = e.clientY - rect.top - this.dragStartPos.y;
            
            ideaBall.style.left = `${x}px`;
            ideaBall.style.top = `${y}px`;
            this.drawConnections();
        });

        ideaBall.addEventListener('dragend', () => {
            this.isDragging = false;
            this.selectedIdea = null;
        });
    }

    enterSelectMode() {
        this.isSelectMode = true;
        this.selectedIdeas = [];
        this.ideas.forEach(idea => {
            idea.element.addEventListener('click', this.handleIdeaSelection);
            idea.element.style.cursor = 'pointer';
        });
    }

    exitSelectMode() {
        this.isSelectMode = false;
        this.selectedIdeas.forEach(idea => {
            idea.element.classList.remove('merge-mode');
        });
        this.ideas.forEach(idea => {
            idea.element.removeEventListener('click', this.handleIdeaSelection);
            idea.element.style.cursor = 'move';
        });
        this.selectedIdeas = [];
    }

    handleIdeaSelection = (e) => {
        e.stopPropagation();
        const clickedElement = e.currentTarget;
        const idea = this.ideas.find(i => i.element === clickedElement);
        
        if (idea) {
            const index = this.selectedIdeas.findIndex(i => i === idea);
            if (index === -1 && this.selectedIdeas.length < 2) {
                this.selectedIdeas.push(idea);
                clickedElement.classList.add('merge-mode');
            } else if (index !== -1) {
                this.selectedIdeas.splice(index, 1);
                clickedElement.classList.remove('merge-mode');
            }
        }
    }

    addIdea(x, y, text, isAIGenerated = false, isCombined = false) {
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'} ${isCombined ? 'combined' : ''}`;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        
        const textContainer = document.createElement('div');
        textContainer.className = 'idea-ball-inner';
        textContainer.innerHTML = `<p class='idea-ball-text'>${text}</p>`;
        ideaBall.appendChild(textContainer);
        
        ideaBall.draggable = true;

        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-sm generate-btn';
        generateBtn.innerHTML = '+';
        generateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleGenerateClick(ideaBall, text);
        });
        ideaBall.appendChild(generateBtn);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn btn-sm info-btn';
        infoBtn.innerHTML = 'i';
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTooltip(ideaBall, text);
        });
        ideaBall.appendChild(infoBtn);

        const mergeBtn = document.createElement('button');
        mergeBtn.className = 'btn btn-sm merge-btn';
        mergeBtn.innerHTML = '⚡';
        mergeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleMergeClick(ideaBall);
        });
        ideaBall.appendChild(mergeBtn);

        this.setupDragListeners(ideaBall);
        
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text: text };
        this.ideas.push(idea);
        this.addToHistory(text);
        return idea;
    }

    async handleMergeClick(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        if (!idea) return;

        const ideaIndex = this.mergeIdeas.findIndex(i => i === idea);
        if (ideaIndex === -1) {
            if (this.mergeIdeas.length < 2) {
                this.mergeIdeas.push(idea);
                ideaBall.classList.add('merge-mode');
            }
        } else {
            this.mergeIdeas.splice(ideaIndex, 1);
            ideaBall.classList.remove('merge-mode');
        }
        
        if (this.mergeIdeas.length === 2) {
            await this.handleMerge();
        }
    }

    async handleGenerateClick(ideaBall, text) {
        try {
            ideaBall.classList.add('generating');
            
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: text })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const rect = ideaBall.getBoundingClientRect();
                const radius = 150;
                
                relatedIdeas.forEach((relatedIdea, index) => {
                    const angle = (2 * Math.PI * index) / relatedIdeas.length;
                    const x = parseInt(ideaBall.style.left) + radius * Math.cos(angle);
                    const y = parseInt(ideaBall.style.top) + radius * Math.sin(angle);
                    
                    const newIdea = this.addIdea(x, y, relatedIdea.text, true);
                    this.connectIdeas(this.ideas.find(i => i.element === ideaBall), newIdea);
                });
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
        } finally {
            ideaBall.classList.remove('generating');
        }
    }

    async handleMerge() {
        const idea1 = this.mergeIdeas[0];
        const idea2 = this.mergeIdeas[1];
        
        try {
            idea1.element.classList.add('generating');
            idea2.element.classList.add('generating');
            
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
                
                const newIdea = this.addIdea(midX, midY, combinedIdeas[0].text, false, true);
                
                this.connectIdeas(idea1, newIdea);
                this.connectIdeas(idea2, newIdea);
            }
        } catch (error) {
            console.error('Error merging ideas:', error);
        } finally {
            idea1.element.classList.remove('generating');
            idea2.element.classList.remove('generating');
            this.mergeIdeas.forEach(idea => {
                idea.element.classList.remove('merge-mode');
            });
            this.mergeIdeas = [];
        }
    }

    connectIdeas(idea1, idea2) {
        this.connections.push({ from: idea1, to: idea2 });
        this.drawConnections();
    }

    drawConnections() {
        const canvas = document.getElementById('connections-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = this.workspace.scrollWidth;
        canvas.height = this.workspace.scrollHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        
        this.connections.forEach(conn => {
            const fromRect = conn.from.element.getBoundingClientRect();
            const toRect = conn.to.element.getBoundingClientRect();
            const workspaceRect = this.workspace.getBoundingClientRect();
            
            const fromX = fromRect.left - workspaceRect.left + fromRect.width/2;
            const fromY = fromRect.top - workspaceRect.top + fromRect.height/2;
            const toX = toRect.left - workspaceRect.left + toRect.width/2;
            const toY = toRect.top - workspaceRect.top + toRect.height/2;
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
        });
    }

    clearWorkspace() {
        this.ideas.forEach(idea => {
            idea.element.remove();
        });
        this.ideas = [];
        this.connections = [];
        this.drawConnections();
    }

    addToHistory(text) {
        const historyList = document.getElementById('ideas-list');
        if (!historyList) return;
        
        const listItem = document.createElement('li');
        listItem.textContent = text;
        
        if (historyList.children.length >= this.maxHistoryItems) {
            historyList.removeChild(historyList.lastChild);
        }
        
        historyList.insertBefore(listItem, historyList.firstChild);
    }
}
