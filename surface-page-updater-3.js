(function() {
    function initHoverHighlight() {
        // Add this near the beginning of the initHoverHighlight function
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';
        fontAwesomeLink.rel = 'stylesheet';
        document.head.appendChild(fontAwesomeLink);

        // Hide the entire page immediately
        document.body.style.visibility = 'hidden';

        // Create a loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.textContent = 'Loading...';
        loadingIndicator.style.position = 'fixed';
        loadingIndicator.style.top = '50%';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.transform = 'translate(-50%, -50%)';
        loadingIndicator.style.fontSize = '24px';
        loadingIndicator.style.zIndex = '10000';
        document.body.appendChild(loadingIndicator);

        // Replace the button creation code with this
        function createIconButton(iconClass, tooltip, backgroundColor) {
            const button = document.createElement('button');
            button.innerHTML = `<i class="${iconClass}"></i>`;
            button.style.position = 'fixed';
            button.style.bottom = '20px';
            button.style.zIndex = '10000';
            button.style.width = '40px';
            button.style.height = '40px';
            button.style.backgroundColor = backgroundColor;
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '5px';
            button.style.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.justifyContent = 'center';
            button.style.alignItems = 'center';
            button.title = tooltip; // This creates the tooltip
            document.body.appendChild(button);
            return button;
        }

        const saveButton = createIconButton('fas fa-save', 'Save Changes', '#4CAF50');
        saveButton.style.right = '20px';

        const revertButton = createIconButton('fas fa-undo', 'Reset Changes', '#f44336');
        revertButton.style.right = '70px';

        const toggleModeButton = createIconButton('fas fa-eye', 'Preview Mode', '#2196F3');
        toggleModeButton.style.right = '120px';

        let selectedElement = null;
        let unsavedChanges = [];
        let savedChanges = [];
        let observer = null;
        let db;
        let allBoundingBoxes = [];

        // Initialize IndexedDB
        const dbName = 'HoverHighlightDB';
        const dbVersion = 1;
        const storeName = 'changes';

        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.error);
            showPage(); // Show the page in case of error
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("IndexedDB opened successfully");
            applyStoredChanges();
        };

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            const objectStore = db.createObjectStore(storeName, { keyPath: "id" });
            console.log("Object store created");
        };

        function generateUniqueId(element) {
            if (!element.id) {
                const xpath = getXPath(element);
                const tagName = element.tagName.toLowerCase();
                const classNames = element.className.split(' ').join('.');
                const textContent = element.textContent.trim().slice(0, 20).replace(/\s+/g, '_');
                element.id = `element-${btoa(`${xpath}|${tagName}|${classNames}|${textContent}`)}`;
            }
            return element.id;
        }

        function getXPath(element) {
            if (element.id !== '') {
                return 'id("' + element.id + '")';
            }
            if (element === document.body) {
                return element.tagName.toLowerCase();
            }

            let ix = 0;
            let siblings = element.parentNode.childNodes;
            for (let i = 0; i < siblings.length; i++) {
                let sibling = siblings[i];
                if (sibling === element) {
                    return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
                }
                if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                    ix++;
                }
            }
        }

        function getElementByXPath(xpath) {
            return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        }

        function getElementByIdentifier(identifier) {
            const [xpath, tagName, classNames, textContent] = atob(identifier.replace('element-', '')).split('|');
            
            // Try XPath first
            let element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            // If XPath fails, try other attributes
            if (!element) {
                const elements = document.getElementsByTagName(tagName);
                for (let el of elements) {
                    if (el.className === classNames.replace(/\./g, ' ').trim() && 
                        el.textContent.trim().startsWith(textContent.replace(/_/g, ' '))) {
                        element = el;
                        break;
                    }
                }
            }
            
            return element;
        }

        function createBoundingBox(element, isChanged = false) {
            const boundingBox = document.createElement('div');
            boundingBox.style.position = 'fixed';
            boundingBox.style.border = '2px solid red'; // Always start with red
            boundingBox.style.pointerEvents = 'none';
            boundingBox.style.zIndex = '9999';
            document.body.appendChild(boundingBox);
            allBoundingBoxes.push({ element, box: boundingBox });
            return boundingBox;
        }

        function updateBoundingBox(element, boundingBox) {
            const rect = element.getBoundingClientRect();
            boundingBox.style.left = `${rect.left}px`;
            boundingBox.style.top = `${rect.top}px`;
            boundingBox.style.width = `${rect.width}px`;
            boundingBox.style.height = `${rect.height}px`;
            boundingBox.style.display = 'block';
        }

        function makeEditable(element) {
            if (!isEditMode) return; // Don't make elements editable in Preview mode

            element.contentEditable = true;
            element.style.outline = 'none';
            element.focus();
            const elementId = generateUniqueId(element);
            if (!element.hasAttribute('data-original-content')) {
                element.setAttribute('data-original-content', element.innerHTML);
            }
            console.log('Made editable:', elementId, 'Original content:', element.getAttribute('data-original-content'));

            showChangedBoundingBox(element, false); // Show red box when first clicked

            if (observer) {
                observer.disconnect();
            }
            observer = new MutationObserver(() => {
                const hasChanged = checkForChanges(element);
                if (hasChanged) {
                    recordChange(element);
                    showChangedBoundingBox(element, true); // Show green box when changed
                } else {
                    showChangedBoundingBox(element, false); // Show red box if reverted to original
                }
            });
            observer.observe(element, { childList: true, characterData: true, subtree: true });
        }

        function stopEditing(element) {
            console.log("Stopped editing:", element.id);
            element.contentEditable = false;
            element.style.outline = '';
            const hasChanged = checkForChanges(element);
            if (hasChanged) {
                recordChange(element);
                showChangedBoundingBox(element, true);
            } else {
                hideChangedBoundingBox(element);
                // Remove from unsavedChanges if no changes were made
                unsavedChanges = unsavedChanges.filter(change => change.id !== element.id);
            }

            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }

        function checkForChanges(element) {
            const originalContent = element.getAttribute('data-original-content');
            const newContent = element.innerHTML;
            return originalContent.trim() !== newContent.trim();
        }

        // Modify the recordChange function
        function recordChange(element) {
            console.log("Recording change for:", element.id);
            const elementId = element.id || generateUniqueId(element);
            const originalContent = element.getAttribute('data-original-content') || element.outerHTML;
            const newContent = element.outerHTML;

            let change = unsavedChanges.find(change => change.id === elementId);
            if (change) {
                change.content = newContent;
                change.pendingEdits = true;
            } else {
                change = savedChanges.find(change => change.id === elementId);
                if (change) {
                    savedChanges = savedChanges.filter(c => c.id !== elementId);
                    change.content = newContent;
                    change.pendingEdits = true;
                    unsavedChanges.push(change);
                } else {
                    unsavedChanges.push({ 
                        id: elementId, 
                        content: newContent, 
                        originalContent: originalContent,
                        pendingEdits: true
                    });
                }
            }
            console.log('Change recorded:', change);
        }

        function showChangedBoundingBox(element, isChanged = false) {
            let boundingBox = element.changedBoundingBox;
            if (!boundingBox) {
                boundingBox = createBoundingBox(element);
                element.changedBoundingBox = boundingBox;
            } else {
                // Ensure the bounding box is in the allBoundingBoxes array
                if (!allBoundingBoxes.some(item => item.box === boundingBox)) {
                    allBoundingBoxes.push({ element, box: boundingBox });
                }
            }
            boundingBox.style.border = isChanged ? '2px solid green' : '2px solid red';
            updateBoundingBox(element, boundingBox);
        }

        function hideChangedBoundingBox(element) {
            if (element.changedBoundingBox) {
                element.changedBoundingBox.style.display = 'none';
                allBoundingBoxes = allBoundingBoxes.filter(item => item.box !== element.changedBoundingBox);
            }
        }

        function saveChangesToIndexedDB() {
            console.log('Changes to save:', unsavedChanges);
            if (unsavedChanges.length === 0) {
                alert('No changes to save.');
                return;
            }

            const transaction = db.transaction([storeName], "readwrite");
            const objectStore = transaction.objectStore(storeName);

            unsavedChanges.forEach(change => {
                change.pendingEdits = false; // Reset pending edits flag
                objectStore.put(change);
            });

            transaction.oncomplete = function(event) {
                console.log("All changes saved to IndexedDB");
                alert('Changes saved successfully!');
                savedChanges = savedChanges.concat(unsavedChanges);
                unsavedChanges.forEach(change => {
                    const element = document.getElementById(change.id);
                    if (element && element.changedBoundingBox) {
                        element.changedBoundingBox.remove();
                        delete element.changedBoundingBox;
                    }
                });
                unsavedChanges = []; // Clear the unsaved changes array after successful save
                hideAllBoundingBoxes(); // Hide all bounding boxes after saving
            };

            transaction.onerror = function(event) {
                console.error("Error saving changes to IndexedDB:", event.target.error);
                alert('Failed to save changes: ' + event.target.error);
            };
        }

        // Modify the applyStoredChanges function
        function applyStoredChanges() {
            console.log('Applying stored changes...');
            const transaction = db.transaction([storeName], "readonly");
            const objectStore = transaction.objectStore(storeName);
            const request = objectStore.getAll();

            request.onsuccess = function(event) {
                const storedChanges = event.target.result;
                console.log('Retrieved changes:', storedChanges);
                savedChanges = storedChanges;
                
                savedChanges.forEach(change => {
                    const elementId = change.id;
                    let element = getElementByIdentifier(elementId);
                    
                    if (element) {
                        console.log(`Applying change to element ${elementId}:`, change);
                        element.setAttribute('data-original-content', change.originalContent);
                        if (element.querySelector('img')) {
                            applyImageChanges(element, change.content);
                        } else {
                            element.innerHTML = change.content;
                        }
                        element.id = elementId; // Ensure the element has the stored ID
                        
                        // Keep pendingEdits as is from the database
                    } else {
                        console.log(`Element with identifier ${elementId} not found`);
                    }
                });

                // Show the page after changes are applied
                showPage();
                
                // Set up event listeners after changes are applied
                setupEventListeners();
            };

            request.onerror = function(event) {
                console.error("Error retrieving changes from IndexedDB:", event.target.error);
                savedChanges = []; // Reset to empty array if there's an error
                showPage();
                setupEventListeners();
            };
        }

        function showPage() {
            // Remove the loading indicator
            loadingIndicator.remove();

            // Make the page visible
            document.body.style.visibility = 'visible';

            // Trigger a repaint to ensure everything is rendered correctly
            window.requestAnimationFrame(() => {
                document.body.style.display = 'none';
                void document.body.offsetHeight; // Trigger reflow
                document.body.style.display = '';
            });
        }

        function setupEventListeners() {
            document.addEventListener('click', function(event) {
                if (!isEditMode) return; // Ignore clicks in Preview mode

                // Remove any existing image menu
                const existingMenu = document.getElementById('image-edit-menu');
                if (existingMenu && !existingMenu.contains(event.target)) {
                    existingMenu.remove();
                }

                if (event.target.tagName.toLowerCase() === 'img') {
                    showImageMenu(event.target);
                    event.preventDefault();
                    return;
                }

                if (selectedElement) {
                    stopEditing(selectedElement);
                }
                
                selectedElement = event.target;
                if (selectedElement.tagName.toLowerCase() !== 'img') {
                    makeEditable(selectedElement);
                }

                // Show all bounding boxes, including red ones for newly selected elements
                showAllUnsavedChangedBoundingBoxes();
                if (!unsavedChanges.some(change => change.id === selectedElement.id)) {
                    showChangedBoundingBox(selectedElement, false);
                }

                // Log the decoded XPath
                const elementId = selectedElement.id || generateUniqueId(selectedElement);
                const decodedInfo = atob(elementId.replace('element-', '')).split('|');
                console.log('Clicked element XPath:', decodedInfo[0]);

                event.preventDefault();
            });

            document.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' && !event.shiftKey && selectedElement) {
                    event.preventDefault();
                    stopEditing(selectedElement);
                }
            });

            saveButton.addEventListener('click', saveChangesToIndexedDB);

            revertButton.addEventListener('click', function() {
                // Clear IndexedDB
                const transaction = db.transaction([storeName], "readwrite");
                const objectStore = transaction.objectStore(storeName);
                const request = objectStore.clear();

                request.onsuccess = function() {
                    console.log("All changes reverted from IndexedDB");
                    alert('All changes have been reverted.');
                    
                    // Reset the page content to original
                    savedChanges.concat(unsavedChanges).forEach(change => {
                        const element = getElementByIdentifier(change.id);
                        if (element) {
                            element.innerHTML = change.originalContent; // Reset to original content
                            element.removeAttribute('data-original-content'); // Clear original content attribute
                        }
                    });
                    
                    // Clear both savedChanges and unsavedChanges arrays
                    savedChanges = [];
                    unsavedChanges = [];
                    
                    // Hide all bounding boxes
                    hideAllBoundingBoxes();
                    
                    // Refresh the page to ensure all changes are reverted
                    location.reload();
                };

                request.onerror = function(event) {
                    console.error("Error reverting changes from IndexedDB:", event.target.error);
                    alert('Failed to revert changes: ' + event.target.error);
                };
            });

            // Add a debounced scroll event listener
            const smoothUpdate = smoothScrollUpdate();
            window.addEventListener('scroll', smoothUpdate, { passive: true });
            window.addEventListener('resize', smoothUpdate);

            toggleModeButton.addEventListener('click', function(event) {
                event.preventDefault();
                toggleEditMode();
            });
        }

        function hideAllBoundingBoxes() {
            allBoundingBoxes.forEach(({ box }) => {
                box.style.display = 'none';
            });
            allBoundingBoxes = [];
            // Clear changedBoundingBox references from all elements
            document.querySelectorAll('[id^="element-"]').forEach(element => {
                if (element.changedBoundingBox) {
                    element.changedBoundingBox.remove();
                    delete element.changedBoundingBox;
                }
            });
        }

        function showAllUnsavedChangedBoundingBoxes() {
            if (!isEditMode) return;
            
            hideAllBoundingBoxes(); // Hide all bounding boxes first
            unsavedChanges.forEach(change => {
                const element = document.getElementById(change.id);
                if (element) {
                    showChangedBoundingBox(element, change.pendingEdits);
                }
            });
        }

        // Replace the existing updateAllBoundingBoxes function with this:
        function updateAllBoundingBoxes() {
            requestAnimationFrame(() => {
                allBoundingBoxes.forEach(({ element, box }) => {
                    if (element && box) {
                        updateBoundingBox(element, box);
                    }
                });
            });
        }

        // Add this new function for smooth scrolling updates
        function smoothScrollUpdate() {
            let ticking = false;
            return function() {
                if (!ticking) {
                    requestAnimationFrame(() => {
                        updateAllBoundingBoxes();
                        ticking = false;
                    });
                    ticking = true;
                }
            };
        }

        // Add this function to create and show the image menu
        function showImageMenu(imgElement) {
            if (!isEditMode) return; // Don't show image menu in Preview mode

            // Remove any existing image menu
            const existingMenu = document.getElementById('image-edit-menu');
            if (existingMenu) existingMenu.remove();

            const menu = document.createElement('div');
            menu.id = 'image-edit-menu';
            menu.style.position = 'absolute';
            menu.style.backgroundColor = 'white';
            menu.style.border = '1px solid black';
            menu.style.padding = '5px';
            menu.style.zIndex = '10000';

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete Image';
            deleteButton.onclick = () => deleteImage(imgElement);

            const replaceButton = document.createElement('button');
            replaceButton.textContent = 'Replace Image';
            replaceButton.onclick = () => replaceImage(imgElement);

            menu.appendChild(deleteButton);
            menu.appendChild(replaceButton);

            document.body.appendChild(menu);

            // Position the menu near the image
            const rect = imgElement.getBoundingClientRect();
            menu.style.left = `${rect.left + window.pageXOffset}px`;
            menu.style.top = `${rect.bottom + window.pageYOffset}px`;
        }

        // Modify the deleteImage function
        function deleteImage(imgElement) {
            if (confirm('Are you sure you want to delete this image?')) {
                const parentElement = imgElement.parentElement;
                recordChange(parentElement);
                imgElement.style.display = 'none'; // Hide the image instead of removing it
                document.getElementById('image-edit-menu').remove();
                showChangedBoundingBox(parentElement, true);
            }
        }

        // Modify the replaceImage function
        function replaceImage(imgElement) {
            const newUrl = prompt('Enter the new image URL:', imgElement.src);
            if (newUrl && newUrl !== imgElement.src) {
                const parentElement = imgElement.parentElement;
                recordChange(parentElement);
                const oldSrc = imgElement.src;
                imgElement.src = newUrl;
                imgElement.onerror = function() {
                    alert('Failed to load the new image. Reverting to the original.');
                    imgElement.src = oldSrc;
                };
                document.getElementById('image-edit-menu').remove();
                showChangedBoundingBox(parentElement, true);
            }
        }

        // Add this function to apply changes to images
        function applyImageChanges(element, content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const newImg = tempDiv.querySelector('img');
            if (newImg) {
                const oldImg = element.querySelector('img');
                if (oldImg) {
                    oldImg.src = newImg.src;
                    oldImg.style.display = newImg.style.display;
                } else {
                    element.innerHTML = content;
                }
            } else {
                element.innerHTML = content;
            }
        }

        // Add this near the beginning of the initHoverHighlight function, after creating the other buttons
        let isEditMode = true; // Start in Edit mode

        // Modify the toggleEditMode function
        function toggleEditMode() {
            isEditMode = !isEditMode;
            toggleModeButton.title = isEditMode ? 'Preview Mode' : 'Edit Mode';
            toggleModeButton.innerHTML = `<i class="${isEditMode ? 'fas fa-eye' : 'fas fa-edit'}"></i>`;
            toggleModeButton.style.backgroundColor = isEditMode ? '#2196F3' : '#FF9800';
            
            if (!isEditMode) {
                // Switching to Preview mode
                if (selectedElement) {
                    stopEditing(selectedElement);
                    selectedElement = null;
                }
                hideAllBoundingBoxes();
            } else {
                // Switching to Edit mode
                showAllUnsavedChangedBoundingBoxes();
            }
            console.log('Edit mode:', isEditMode);
        }

        // Add styles for tooltips
        const style = document.createElement('style');
        style.textContent = `
            button[title]:hover::after {
                content: attr(title);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                padding: 5px;
                background-color: black;
                color: white;
                border-radius: 3px;
                font-size: 14px;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('load', function() {
            requestAnimationFrame(function() {
                initHoverHighlight();
            });
        });
    }
})();
