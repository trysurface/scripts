const stressTest = () => {
  Array.from(document.getElementsByClassName("surface-stress-test-button")).forEach(
    (button) => {
      button.addEventListener("click", async () => {
        // call multiple API calls to random API endpoints real
        const apiEndpoints = Array.from(
          { length: 50 },
          () => `https://jsonplaceholder.typicode.com/posts`
        );

        for (const endpoint of apiEndpoints) {
          try {
            const response = await fetch(endpoint);
            const data = await response.json();
            console.log(`API call completed: ${endpoint}`);
          } catch (error) {
            console.error(`API call failed: ${endpoint}: ${error}`);
          }
        }
      });
    }
  );

  Array.from(document.getElementsByClassName("surface-form-handler-stress-test")).forEach(
    (form) => {
      form.addEventListener("submit", async () => {
        // call multiple API calls to random API endpoints real
        const apiEndpoints = Array.from(
          { length: 50 },
          () => `https://jsonplaceholder.typicode.com/posts`
        );

        for (const endpoint of apiEndpoints) {
          try {
            const response = await fetch(endpoint);
            const data = await response.json();
            console.log(`API call completed: ${endpoint}`);
          } catch (error) {
            console.error(`API call failed: ${endpoint}: ${error}`);
          }
        }
      });
    }
  );
};

stressTest();
