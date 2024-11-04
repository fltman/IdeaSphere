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
        const damping = 0.85;  // Changed from 0.98 to 0.85 for more friction
        const minSpeed = 0.1;

        for (const idea of this.ideas) {
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
        }

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
                    const overlap = minDistance - distance;
                    
                    // Calculate normal vector
                    const nx = dx / distance;
                    const ny = dy / distance;
                    
                    // Relative velocity
                    const vel1 = this.velocities.get(idea1) || { x: 0, y: 0 };
                    const vel2 = this.velocities.get(idea2) || { x: 0, y: 0 };
                    const relativeVelocityX = vel1.x - vel2.x;
                    const relativeVelocityY = vel1.y - vel2.y;
                    
                    // Normal velocity
                    const normalVelocity = relativeVelocityX * nx + relativeVelocityY * ny;
                    
                    // Only separate if objects are moving towards each other
                    if (normalVelocity < 0) {
                        const restitution = 0.5;  // Bounciness factor
                        const impulse = -(1 + restitution) * normalVelocity;
                        
                        const impulseX = impulse * nx;
                        const impulseY = impulse * ny;
                        
                        vel1.x += impulseX;
                        vel1.y += impulseY;
                        vel2.x -= impulseX;
                        vel2.y -= impulseY;
                        
                        const collisionDamping = 0.85;
                        vel1.x *= collisionDamping;
                        vel1.y *= collisionDamping;
                        vel2.x *= collisionDamping;
                        vel2.y *= collisionDamping;
                        
                        this.velocities.set(idea1, vel1);
                        this.velocities.set(idea2, vel2);
                        
                        // Separate the balls
                        const separationX = (overlap * nx) / 2;
                        const separationY = (overlap * ny) / 2;
                        
                        idea1.element.style.left = `${pos1.x - separationX}px`;
                        idea1.element.style.top = `${pos1.y - separationY}px`;
                        idea2.element.style.left = `${pos2.x + separationX}px`;
                        idea2.element.style.top = `${pos2.y + separationY}px`;
                    }
                }
            }
        }

        this.drawConnections();
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
                this.velocities.set(idea, { x: 0, y: 0 });
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
            this.drawConnections();
        });

        ideaBall.addEventListener('dragend', (e) => {
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
        });
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
            this.handleMergeMode(ideaBall);
        });
        ideaBall.appendChild(mergeBtn);

        this.setupDragListeners(ideaBall);
        
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text: text };
        this.ideas.push(idea);
        this.addToHistory(text, true);
        return idea;
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
            ideaBall.classList.remove('generating');
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 150;
                
                const idea = this.ideas.find(i => i.element === ideaBall);
                relatedIdeas.forEach((relatedIdea, index) => {
                    const angle = (2 * Math.PI * index) / relatedIdeas.length;
                    const x = parseInt(ideaBall.style.left) + radius * Math.cos(angle);
                    const y = parseInt(ideaBall.style.top) + radius * Math.sin(angle);
                    
                    const newIdea = this.addIdea(x, y, relatedIdea.text, true);
                    this.connectIdeas(idea, newIdea);
                });
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
            ideaBall.classList.remove('generating');
        }
    }

    async handleMergeMode(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        const ideaIndex = this.mergeIdeas.indexOf(idea);
        
        if (ideaIndex === -1) {
            if (this.mergeIdeas.length < 2) {
                ideaBall.classList.add('merge-mode');
                this.mergeIdeas.push(idea);
                
                if (this.mergeIdeas.length === 2) {
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
            }
        } else {
            ideaBall.classList.remove('merge-mode');
            this.mergeIdeas.splice(ideaIndex, 1);
        }
    }

    connectIdeas(idea1, idea2) {
        const connection = { from: idea1, to: idea2 };
        this.connections.push(connection);
        this.drawConnections();
    }

    clearWorkspace() {
        while (this.workspace.firstChild) {
            this.workspace.removeChild(this.workspace.firstChild);
        }
        this.ideas = [];
        this.connections = [];
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

    updateHistoryList() {
        const list = document.getElementById('ideas-list');
        list.innerHTML = '';
        this.generatedIdeas.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
    }

    showTooltip(ideaBall, text) {
        const existingTooltip = ideaBall.querySelector('.idea-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
            return;
        }
        
        document.querySelectorAll('.idea-tooltip').forEach(tooltip => tooltip.remove());
        
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.textContent = text;
        tooltip.style.left = '130px';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translateY(-50%)';
        ideaBall.appendChild(tooltip);
    }
}
