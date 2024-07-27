Vue.component('top-bar', {
    template: `
      <div class="top-bar">
        <div>
          <button>Previous</button>
          <button>Next</button>
        </div>
        <div>
          <select>
            <option selected disabled>Add view</option>
            <option>Display value</option>
            <option>View web page</option>
            <option>View Wikimedia site</option>
            <option>Compare coordinates</option>
            <option>Compare dates</option>
            <option>View all properties</option>
            <option>Reconciliation settings</option>
          </select>
          <button>Close</button>
        </div>
      </div>
    `
  });
  