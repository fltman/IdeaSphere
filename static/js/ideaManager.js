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
        this.timerDuration = 300 * 1000; // Default 300 seconds (5 minutes)
        this.remainingTime = this.timerDuration;
        this.isTimerPaused = false;
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.velocities = new Map();
        this.lastFrameTime = performance.now();
        this.animationFrame = null;

        this.setupEventListeners();
        this.updateCountdownDisplay();
        this.startPhysicsLoop();

        window.addEventListener('resize', () => {
            this.drawConnections();
        });
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
    }

    updateCountdownDisplay() {
        if (!this.countdownDisplay) return;
        
        if (!this.timer) {
            this.countdownDisplay.textContent = '';
            return;
        }
        
        const seconds = Math.ceil(this.remainingTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        this.countdownDisplay.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
            
            const fromX = fromRect.left - workspaceRect.left + this.workspace.scrollLeft + fromRect.width/2;
            const fromY = fromRect.top - workspaceRect.top + this.workspace.scrollTop + fromRect.height/2;
            const toX = toRect.left - workspaceRect.left + this.workspace.scrollLeft + toRect.width/2;
            const toY = toRect.top - workspaceRect.top + this.workspace.scrollTop + toRect.height/2;
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
        });
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
        this.setupDragListeners(ideaBall);
        
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text: text };
        this.ideas.push(idea);
        this.addToHistory(text, true);
        return idea;
    }

    connectIdeas(idea1, idea2) {
        const connection = { from: idea1, to: idea2 };
        this.connections.push(connection);
        this.drawConnections();
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

    handleMergeMode(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        if (!idea) return;

        const ideaIndex = this.mergeIdeas.indexOf(idea);
        
        if (ideaIndex === -1 && this.mergeIdeas.length < 2) {
            ideaBall.classList.add('merge-mode');
            this.mergeIdeas.push(idea);
            
            if (this.mergeIdeas.length === 2) {
                this.combineMergedIdeas();
            }
        } else if (ideaIndex !== -1) {
            ideaBall.classList.remove('merge-mode');
            this.mergeIdeas.splice(ideaIndex, 1);
        }
    }

    async combineMergedIdeas() {
        const idea1 = this.mergeIdeas[0];
        const idea2 = this.mergeIdeas[1];
        
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
                
                const newIdea = this.addIdea(midX, midY, combinedIdeas[0].text, false, true);
                this.connectIdeas(idea1, newIdea);
                this.connectIdeas(idea2, newIdea);
            }
        } catch (error) {
            console.error('Error merging ideas:', error);
        } finally {
            idea1.element.classList.remove('generating');
            idea2.element.classList.remove('generating');
            this.mergeIdeas.forEach(idea => idea.element.classList.remove('merge-mode'));
            this.mergeIdeas = [];
        }
    }

    setTimerDuration(seconds) {
        this.timerDuration = seconds * 1000;  // Convert seconds to milliseconds
        this.remainingTime = this.timerDuration;
        this.updateCountdownDisplay();
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

    updatePhysics(deltaTime) {
        const damping = 0.98;
        const minSpeed = 0.1;

        this.ideas.forEach(idea => {
            if (!this.isDragging || idea.element !== this.selectedIdea) {
                let velocity = this.velocities.get(idea) || { x: 0, y: 0 };
                
                const rect = idea.element.getBoundingClientRect();
                const workspaceRect = this.workspace.getBoundingClientRect();
                
                let x = parseInt(idea.element.style.left) + velocity.x * deltaTime;
                let y = parseInt(idea.element.style.top) + velocity.y * deltaTime;

                const radius = rect.width / 2;
                const minX = radius;
                const maxX = this.workspace.clientWidth - radius;
                const minY = radius;
                const maxY = this.workspace.clientHeight - radius;

                if (x < minX) {
                    x = minX;
                    velocity.x = Math.abs(velocity.x);
                } else if (x > maxX) {
                    x = maxX;
                    velocity.x = -Math.abs(velocity.x);
                }

                if (y < minY) {
                    y = minY;
                    velocity.y = Math.abs(velocity.y);
                } else if (y > maxY) {
                    y = maxY;
                    velocity.y = -Math.abs(velocity.y);
                }

                velocity.x *= damping;
                velocity.y *= damping;

                if (Math.abs(velocity.x) < minSpeed) velocity.x = 0;
                if (Math.abs(velocity.y) < minSpeed) velocity.y = 0;

                idea.element.style.left = `${x}px`;
                idea.element.style.top = `${y}px`;
                this.velocities.set(idea, velocity);
            }
        });

        this.handleCollisions();
        this.drawConnections();
    }

    handleCollisions() {
        for (let i = 0; i < this.ideas.length; i++) {
            for (let j = i + 1; j < this.ideas.length; j++) {
                const idea1 = this.ideas[i];
                const idea2 = this.ideas[j];

                if (this.isDragging && (idea1.element === this.selectedIdea || idea2.element === this.selectedIdea)) {
                    continue;
                }

                const pos1 = {
                    x: parseInt(idea1.element.style.left),
                    y: parseInt(idea1.element.style.top)
                };
                const pos2 = {
                    x: parseInt(idea2.element.style.left),
                    y: parseInt(idea2.element.style.top)
                };

                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = 120;

                if (distance < minDistance) {
                    this.resolveCollision(idea1, idea2, pos1, pos2, dx, dy, distance, minDistance);
                }
            }
        }
    }

    resolveCollision(idea1, idea2, pos1, pos2, dx, dy, distance, minDistance) {
        const angle = Math.atan2(dy, dx);
        const vel1 = this.velocities.get(idea1) || { x: 0, y: 0 };
        const vel2 = this.velocities.get(idea2) || { x: 0, y: 0 };

        const speed1 = Math.sqrt(vel1.x * vel1.x + vel1.y * vel1.y);
        const speed2 = Math.sqrt(vel2.x * vel2.x + vel2.y * vel2.y);

        const newVel1 = {
            x: speed2 * Math.cos(angle),
            y: speed2 * Math.sin(angle)
        };
        const newVel2 = {
            x: speed1 * Math.cos(angle + Math.PI),
            y: speed1 * Math.sin(angle + Math.PI)
        };

        if (speed1 < 0.1 && speed2 < 0.1) {
            const pushForce = 100;
            newVel1.x = pushForce * Math.cos(angle);
            newVel1.y = pushForce * Math.sin(angle);
            newVel2.x = -pushForce * Math.cos(angle);
            newVel2.y = -pushForce * Math.sin(angle);
        }

        this.velocities.set(idea1, newVel1);
        this.velocities.set(idea2, newVel2);

        const overlap = minDistance - distance;
        const separationX = (overlap * dx) / distance / 2;
        const separationY = (overlap * dy) / distance / 2;

        idea1.element.style.left = `${pos1.x - separationX}px`;
        idea1.element.style.top = `${pos1.y - separationY}px`;
        idea2.element.style.left = `${pos2.x + separationX}px`;
        idea2.element.style.top = `${pos2.y + separationY}px`;
    }

    setupDragListeners(ideaBall) {
        ideaBall.addEventListener('dragstart', this.handleDragStart.bind(this));
        ideaBall.addEventListener('drag', this.handleDrag.bind(this));
        ideaBall.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    handleDragStart(e) {
        if (!this.isSelectMode) {
            this.isDragging = true;
            this.selectedIdea = e.target;
            const rect = e.target.getBoundingClientRect();
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

            const idea = this.ideas.find(i => i.element === this.selectedIdea);
            this.velocities.set(idea, { x: 0, y: 0 });
        }
    }

    handleDrag(e) {
        if (this.isSelectMode || !e.clientX) return;
        
        const rect = this.workspace.getBoundingClientRect();
        const x = e.clientX - rect.left + this.workspace.scrollLeft - this.dragStartPos.x;
        const y = e.clientY - rect.top + this.workspace.scrollTop - this.dragStartPos.y;
        
        const minPadding = 60;
        const boundedX = Math.max(minPadding, Math.min(x, this.workspace.clientWidth - minPadding));
        const boundedY = Math.max(minPadding, Math.min(y, this.workspace.clientHeight - minPadding));
        
        this.selectedIdea.style.left = `${boundedX}px`;
        this.selectedIdea.style.top = `${boundedY}px`;
        this.drawConnections();
    }

    handleDragEnd() {
        if (this.isDragging && this.selectedIdea) {
            const idea = this.ideas.find(i => i.element === this.selectedIdea);
            if (idea) {
                const lastX = parseInt(this.selectedIdea.style.left);
                const lastY = parseInt(this.selectedIdea.style.top);
                const deltaX = lastX - parseInt(this.selectedIdea.style.left);
                const deltaY = lastY - parseInt(this.selectedIdea.style.top);
                
                this.velocities.set(idea, {
                    x: deltaX * 5,
                    y: deltaY * 5
                });
            }
        }
        this.isDragging = false;
        this.selectedIdea = null;
    }

    updateHistoryList() {
        const list = document.getElementById('ideas-list');
        if (!list) return;
        
        list.innerHTML = '';
        this.generatedIdeas.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
    }
}
