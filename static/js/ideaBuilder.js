document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const ideaManager = new IdeaManager('idea-workspace');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const clearCanvasBtn = document.getElementById('clearCanvas');
    let pendingIdeaPosition = null;

    async function generateIdeasForParent(parentIdea) {
        try {
            console.log('Sending request to generate ideas for:', parentIdea.text);
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: parentIdea.text })
            });

            const data = await response.json();
            console.log('Received response:', data);
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 200;
                const angleStep = (2 * Math.PI) / relatedIdeas.length;
                const parentRect = parentIdea.element.getBoundingClientRect();
                const parentX = parseInt(parentIdea.element.style.left);
                const parentY = parseInt(parentIdea.element.style.top);

                relatedIdeas.forEach((idea, index) => {
                    const angle = index * angleStep;
                    const x = parentX + radius * Math.cos(angle);
                    const y = parentY + radius * Math.sin(angle);
                    
                    console.log('Creating related idea:', { text: idea.text, x, y });
                    const newIdea = ideaManager.addIdea(x, y, idea.text, true);
                    ideaManager.connectIdeas(parentIdea, newIdea);
                });

                ideaManager.centerOnPoint(parentX, parentY);
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
        }
    }

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
            
            // Add click handler for the generate button
            const generateBtn = newIdea.element.querySelector('.generate-btn');
            generateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await generateIdeasForParent(newIdea);
            });
            
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
});
