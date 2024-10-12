(function() {
    // Wrap the entire script in a function
    function initHoverHighlight() {
        const boundingBox = document.createElement('div');
        boundingBox.style.position = 'absolute';
        boundingBox.style.border = '2px solid red';
        boundingBox.style.pointerEvents = 'none';
        boundingBox.style.zIndex = '9999';
        document.body.appendChild(boundingBox);

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
        let changes = [];
        let observer = null;
        let db;

        // Initialize IndexedDB
        const dbName = 'HoverHighlightDB';
        const dbVersion = 1;
        const storeName = 'changes';

        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.error);
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

        function updateBoundingBox(element, isChanged = false) {
            const rect = element.getBoundingClientRect();
            boundingBox.style.left = rect.left + window.scrollX + 'px';
            boundingBox.style.top = rect.top + window.scrollY + 'px';
            boundingBox.style.width = rect.width + 'px';
            boundingBox.style.height = rect.height + 'px';
            boundingBox.style.display = 'block';
            boundingBox.style.border = isChanged ? '2px solid green' : '2px solid red';
        }

        function makeEditable(element) {
            element.contentEditable = true;
            element.style.outline = 'none';
            element.focus();
            const elementId = generateUniqueId(element);
            element.setAttribute('data-original-content', element.innerHTML);
            console.log('Made editable:', elementId, 'Original content:', element.innerHTML);

            // Set up MutationObserver to watch for content changes
            if (observer) {
                observer.disconnect();
            }
            observer = new MutationObserver(() => {
                updateBoundingBox(element, true);
            });
            observer.observe(element, { childList: true, characterData: true, subtree: true });
        }

        function stopEditing(element) {
            console.log("Stopped editing:", element.id);
            element.contentEditable = false;
            element.style.outline = '';
            const hasChanged = recordChange(element);
            updateBoundingBox(element, hasChanged);  // Keep green bounding box if changed
            selectedElement = null;

            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }

        function recordChange(element) {
            console.log("Recording change for:", element.id);
            const elementId = element.id;
            const originalContent = element.getAttribute('data-original-content');
            const newContent = element.innerHTML;

            console.log('Element ID:', elementId);
            console.log('Original content:', originalContent);
            console.log('New content:', newContent);

            // Check if originalContent is null or undefined
            if (originalContent === null || originalContent === undefined) {
                console.log('Original content is null or undefined. Setting it now.');
                element.setAttribute('data-original-content', newContent);
                return; // Exit the function as we can't compare changes yet
            }

            // Trim whitespace and compare
            if (originalContent.trim() !== newContent.trim()) {
                console.log("Change detected");
                try {
                    console.log("Current changes array:", changes);
                    
                    // Ensure changes is an array
                    if (!Array.isArray(changes)) {
                        console.log("changes is not an array. Resetting to empty array.");
                        changes = [];
                    }

                    const changeIndex = changes.findIndex(change => change.id === elementId);
                    console.log("Change index:", changeIndex);

                    if (changeIndex !== -1) {
                        console.log("Updating existing change");
                        changes[changeIndex].content = newContent;
                    } else {
                        console.log("Adding new change");
                        changes.push({ id: elementId, content: newContent, originalContent: originalContent });
                    }
                    console.log('Change recorded:', { id: elementId, content: newContent, originalContent: originalContent });
                    return true; // Indicate that a change was made
                } catch (error) {
                    console.error("Error in recordChange function:", error);
                }
            } else {
                console.log('No change detected');
                return false; // Indicate that no change was made
            }
        }

        function saveChangesToIndexedDB() {
            console.log('Changes to save:', changes);
            if (changes.length === 0) {
                alert('No changes to save.');
                return;
            }

            const transaction = db.transaction([storeName], "readwrite");
            const objectStore = transaction.objectStore(storeName);

            changes.forEach(change => {
                objectStore.put(change);
            });

            transaction.oncomplete = function(event) {
                console.log("All changes saved to IndexedDB");
                alert('Changes saved successfully!');
                changes = []; // Clear the changes array after successful save
                boundingBox.style.display = 'none'; // Hide the bounding box
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
                changes = storedChanges;
                
                changes.forEach(change => {
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

                // Remove any hiding class or show the body after changes are applied
                document.body.style.visibility = 'visible';
            };

            request.onerror = function(event) {
                console.error("Error retrieving changes from IndexedDB:", event.target.error);
                changes = []; // Reset to empty array if there's an error
                document.body.style.visibility = 'visible';
            };
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

        document.addEventListener('mouseover', function(event) {
            if (!selectedElement && changes.length === 0) {
                updateBoundingBox(event.target);
            }
        });

        document.addEventListener('mouseout', function(event) {
            if (!selectedElement && event.target !== boundingBox && changes.length === 0) {
                boundingBox.style.display = 'none';
            }
        });

        document.addEventListener('click', function(event) {
            if (selectedElement) {
                stopEditing(selectedElement);
            }
            
            selectedElement = event.target;
            makeEditable(selectedElement);
            updateBoundingBox(selectedElement);

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

        // We don't need to wait for DOMContentLoaded here, as we're already waiting for IndexedDB to open
    }

    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
        // Wait for the page to be fully loaded and hydrated
        window.addEventListener('load', function() {
            // Use requestAnimationFrame to ensure we're running after React's updates
            requestAnimationFrame(function() {
                // Small delay to ensure React has finished hydration
                setTimeout(initHoverHighlight, 100);
            });
        });
    }
})();
