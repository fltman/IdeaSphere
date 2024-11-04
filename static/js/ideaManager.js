[Previous content up to line 318]
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove existing tooltip for this idea
            const existingTooltip = ideaBall.querySelector('.idea-tooltip');
            if (existingTooltip) {
                existingTooltip.remove();
                return;
            }
            
            const tooltip = document.createElement('div');
            tooltip.className = 'idea-tooltip';
            tooltip.textContent = text;
            
            // Attach tooltip to idea ball instead of body
            ideaBall.appendChild(tooltip);
            
            // Position tooltip relative to idea ball
            tooltip.style.position = 'absolute';
            tooltip.style.left = '60px';  // Half of idea ball width (120px)
            tooltip.style.top = '-120px';
            
            // Update tooltip position during drag
            const updateTooltipPosition = () => {
                if (tooltip && tooltip.parentElement) {
                    tooltip.style.left = '60px';
                    tooltip.style.top = '-120px';
                }
            };
            
            // Add drag listeners for tooltip repositioning
            ideaBall.addEventListener('drag', updateTooltipPosition);
            
            // Remove tooltip when clicking outside
            const removeTooltip = (e) => {
                if (!tooltip.contains(e.target) && e.target !== infoBtn) {
                    document.removeEventListener('click', removeTooltip);
                    ideaBall.removeEventListener('drag', updateTooltipPosition);
                    tooltip.remove();
                }
            };
            setTimeout(() => document.addEventListener('click', removeTooltip), 0);
        });
[Rest of the file content remains the same]
