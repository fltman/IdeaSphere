// Previous code remains unchanged until line 161
    updatePhysics(deltaTime) {
        const damping = 0.95;  // More aggressive damping
        const groundFriction = 0.98; // Additional friction when moving
        const minSpeed = 0.5;  // Increased minimum speed threshold

        for (const idea of this.ideas) {
            if (!this.isDragging || idea.element !== this.selectedIdea) {
                let velocity = this.velocities.get(idea) || { x: 0, y: 0 };
                
                // Apply ground friction when moving
                if (Math.abs(velocity.x) > 0 || Math.abs(velocity.y) > 0) {
                    velocity.x *= groundFriction;
                    velocity.y *= groundFriction;
                }
                
                // Apply damping after collision
                velocity.x *= damping;
                velocity.y *= damping;
                
                // Stop if below minimum speed
                if (Math.abs(velocity.x) < minSpeed) velocity.x = 0;
                if (Math.abs(velocity.y) < minSpeed) velocity.y = 0;
                
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

                idea.element.style.left = `${x}px`;
                idea.element.style.top = `${y}px`;
                this.velocities.set(idea, velocity);
            }
        }

        // Rest of the collision detection code remains the same
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
                    const speed = Math.max(100, 0); // Set a minimum repulsion speed
                    
                    const newVel1 = {
                        x: -speed * Math.cos(angle),
                        y: -speed * Math.sin(angle)
                    };
                    const newVel2 = {
                        x: speed * Math.cos(angle),
                        y: speed * Math.sin(angle)
                    };
                    
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
    // Rest of the code remains unchanged
