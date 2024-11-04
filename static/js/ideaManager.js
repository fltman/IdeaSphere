class IdeaManager {
    constructor(workspaceId) {
        this.workspace = document.getElementById(workspaceId);
        this.ideas = [];
        this.connections = [];
        this.selectedIdeas = [];
        this.isSelectMode = false;
        this.velocities = new Map();
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.selectedIdea = null;
        this.lastFrameTime = performance.now();
        this.animationFrame = null;

        this.setupEventListeners();
        this.startPhysicsLoop();
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

        window.addEventListener('resize', () => {
            this.drawConnections();
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
        const damping = 0.98;
        const minSpeed = 0.1;

        for (const idea of this.ideas) {
            if (!this.isDragging || idea.element !== this.selectedIdea) {
                let velocity = this.velocities.get(idea) || { x: 0, y: 0 };
                
                let x = parseInt(idea.element.style.left) + velocity.x * deltaTime;
                let y = parseInt(idea.element.style.top) + velocity.y * deltaTime;

                const minPadding = 60;
                const minX = 250 + minPadding;
                const maxX = this.workspace.clientWidth - minPadding;
                const minY = minPadding;
                const maxY = this.workspace.clientHeight - minPadding;

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
            }
        }

        this.drawConnections();
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
            
            const minPadding = 60;
            const minX = 250 + minPadding;
            const boundedX = Math.max(minX, Math.min(x, this.workspace.clientWidth - minPadding));
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

    addIdea(x, y, text, isAIGenerated = false, isCombined = false) {
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'} ${isCombined ? 'combined' : ''}`;
        ideaBall.draggable = true;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        
        const inner = document.createElement('div');
        inner.className = 'idea-ball-inner';
        inner.innerHTML = `<p class="idea-ball-text">${text}</p>`;
        ideaBall.appendChild(inner);

        const generateBtn = document.createElement('button');
        generateBtn.className = 'generate-btn';
        generateBtn.innerHTML = '+';
        ideaBall.appendChild(generateBtn);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'info-btn';
        infoBtn.innerHTML = 'i';
        ideaBall.appendChild(infoBtn);

        const mergeBtn = document.createElement('button');
        mergeBtn.className = 'merge-btn';
        mergeBtn.innerHTML = '⟲';
        ideaBall.appendChild(mergeBtn);

        generateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idea = this.ideas.find(i => i.element === ideaBall);
            idea.element.classList.add('generating');
            
            fetch('/generate-ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea: text })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const generatedIdeas = JSON.parse(data.data).ideas;
                    const radius = 150;
                    const angleStep = (2 * Math.PI) / generatedIdeas.length;
                    
                    generatedIdeas.forEach((genIdea, index) => {
                        const angle = angleStep * index;
                        const newX = parseInt(idea.element.style.left) + radius * Math.cos(angle);
                        const newY = parseInt(idea.element.style.top) + radius * Math.sin(angle);
                        const newIdeaObj = this.addIdea(newX, newY, genIdea.text, true);
                        this.connectIdeas(idea, newIdeaObj);
                    });
                }
            })
            .finally(() => {
                idea.element.classList.remove('generating');
            });
        });

        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = document.createElement('div');
            tooltip.className = 'idea-tooltip';
            tooltip.textContent = text;
            tooltip.style.position = 'absolute';
            
            const rect = ideaBall.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - 120) + 'px';
            
            document.body.appendChild(tooltip);
            
            const removeTooltip = (e) => {
                if (!tooltip.contains(e.target) && e.target !== infoBtn) {
                    document.removeEventListener('click', removeTooltip);
                    tooltip.remove();
                }
            };
            setTimeout(() => document.addEventListener('click', removeTooltip), 0);
        });

        mergeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idea = this.ideas.find(i => i.element === ideaBall);
            if (!this.isSelectMode) {
                this.enterSelectMode();
                this.selectedIdeas = [idea];
                idea.element.classList.add('selected');
                document.getElementById('combineIdeasBtn').click();
            }
        });
        
        this.setupDragListeners(ideaBall);
        this.workspace.appendChild(ideaBall);
        
        const idea = { element: ideaBall, text, isAIGenerated };
        this.ideas.push(idea);
        this.velocities.set(idea, { x: 0, y: 0 });
        
        return idea;
    }

    clearWorkspace() {
        this.ideas.forEach(idea => idea.element.remove());
        this.ideas = [];
        this.connections = [];
        this.velocities.clear();
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
}