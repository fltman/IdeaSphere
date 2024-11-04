// Previous code remains the same until updatePhysics method
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
                    const angle = Math.atan2(dy, dx);
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
                        const restitution = 0.5;  // Bounciness factor (0 = no bounce, 1 = perfect bounce)
                        const impulse = -(1 + restitution) * normalVelocity;
                        
                        // Apply impulse along the normal
                        const impulseX = impulse * nx;
                        const impulseY = impulse * ny;
                        
                        vel1.x += impulseX;
                        vel1.y += impulseY;
                        vel2.x -= impulseX;
                        vel2.y -= impulseY;
                        
                        // Increase damping/friction
                        const damping = 0.85;  // Changed from 0.98 to 0.85 for more friction
                        vel1.x *= damping;
                        vel1.y *= damping;
                        vel2.x *= damping;
                        vel2.y *= damping;
                        
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
// Rest of the code remains the same
