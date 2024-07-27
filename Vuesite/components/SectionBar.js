Vue.component('section-bar', {
    data() {
      return {
        query: ''
      };
    },
    template: `
      <div class="section-2">
        <input v-model="query" @keydown.enter="onSubmit" placeholder="Input here" />
        <button @click="onSubmit">Submit</button>
        <button>Don't reconcile cell</button>
        <button>New item</button>
      </div>
    `,
    methods: {
      onSubmit() {
        this.$emit('submit-query', this.query);
      }
    }
  });
  