(function() {
    function initHoverHighlight() {
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

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Changes';
        saveButton.style.position = 'fixed';
        saveButton.style.bottom = '20px';
        saveButton.style.right = '20px';
        saveButton.style.zIndex = '10000';
        saveButton.style.padding = '10px 20px';
        saveButton.style.backgroundColor = '#4CAF50';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '5px';
        saveButton.style.cursor = 'pointer';
        document.body.appendChild(saveButton);

        let selectedElement = null;
        let unsavedChanges = [];
        let savedChanges = [];
        let observer = null;
        let db;

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
            boundingBox.style.position = 'absolute';
            boundingBox.style.border = isChanged ? '2px solid green' : '2px solid red';
            boundingBox.style.pointerEvents = 'none';
            boundingBox.style.zIndex = '9999';
            document.body.appendChild(boundingBox);
            return boundingBox;
        }

        function updateBoundingBox(element, boundingBox) {
            const rect = element.getBoundingClientRect();
            boundingBox.style.left = rect.left + window.scrollX + 'px';
            boundingBox.style.top = rect.top + window.scrollY + 'px';
            boundingBox.style.width = rect.width + 'px';
            boundingBox.style.height = rect.height + 'px';
            boundingBox.style.display = 'block';
        }

        function makeEditable(element) {
            element.contentEditable = true;
            element.style.outline = 'none';
            element.focus();
            const elementId = generateUniqueId(element);
            if (!element.hasAttribute('data-original-content')) {
                element.setAttribute('data-original-content', element.innerHTML);
            }
            console.log('Made editable:', elementId, 'Original content:', element.getAttribute('data-original-content'));

            if (observer) {
                observer.disconnect();
            }
            observer = new MutationObserver(() => {
                const hasChanged = checkForChanges(element);
                if (hasChanged) {
                    showChangedBoundingBox(element);
                } else {
                    hideChangedBoundingBox(element);
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
                showChangedBoundingBox(element);
            } else {
                hideChangedBoundingBox(element);
            }
            selectedElement = null;

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

        function recordChange(element) {
            console.log("Recording change for:", element.id);
            const elementId = element.id;
            const originalContent = element.getAttribute('data-original-content');
            const newContent = element.innerHTML;

            const changeIndex = unsavedChanges.findIndex(change => change.id === elementId);
            if (changeIndex !== -1) {
                unsavedChanges[changeIndex].content = newContent;
            } else {
                unsavedChanges.push({ id: elementId, content: newContent, originalContent: originalContent });
            }
            console.log('Change recorded:', { id: elementId, content: newContent, originalContent: originalContent });
        }

        function showChangedBoundingBox(element) {
            // Only show bounding box if the element has unsaved changes
            if (unsavedChanges.some(change => change.id === element.id)) {
                let boundingBox = element.changedBoundingBox;
                if (!boundingBox) {
                    boundingBox = createBoundingBox(element, true);
                    element.changedBoundingBox = boundingBox;
                }
                updateBoundingBox(element, boundingBox);
                boundingBox.style.display = 'block';
            }
        }

        function hideChangedBoundingBox(element) {
            if (element.changedBoundingBox) {
                element.changedBoundingBox.style.display = 'none';
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
                        element.innerHTML = change.content;
                        element.id = elementId; // Ensure the element has the stored ID
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
                if (selectedElement) {
                    stopEditing(selectedElement);
                }
                
                selectedElement = event.target;
                makeEditable(selectedElement);

                // Show all unsaved changed bounding boxes when user interacts with the page
                showAllUnsavedChangedBoundingBoxes();

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
        }

        function hideAllBoundingBoxes() {
            document.querySelectorAll('[id^="element-"]').forEach(element => {
                hideChangedBoundingBox(element);
            });
        }

        function showAllUnsavedChangedBoundingBoxes() {
            hideAllBoundingBoxes(); // Hide all bounding boxes first
            unsavedChanges.forEach(change => {
                const element = document.getElementById(change.id);
                if (element) {
                    showChangedBoundingBox(element);
                }
            });
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('load', function() {
            requestAnimationFrame(function() {
                initHoverHighlight();
            });
        });
    }
})();
