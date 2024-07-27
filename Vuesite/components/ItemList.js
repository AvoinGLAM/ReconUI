Vue.component('item-list', {
    props: ['items'],
    template: `
      <div class="left-pane">
        <div
          v-for="item in items"
          :key="item.item.value"
          :class="['item', { selected: item.selected }]"
          @click="selectItem(item)"
        >
          <img :src="getImageUrl(item)" alt="QID Image" />
          <div class="item-details">
            <span><strong>{{ item.itemLabel.value }}</strong></span>
            <a :href="'https://www.wikidata.org/wiki/' + item.item.value.split('/').pop()" target="_blank" class="qid-link">{{ item.item.value.split('/').pop() }}</a>
            <div>{{ item.itemDescription ? item.itemDescription.value : 'No description available' }}</div>
          </div>
          <button>Match</button>
        </div>
      </div>
    `,
    methods: {
      selectItem(item) {
        this.$emit('select-item', item);
      },
      getImageUrl(item) {
        return item.image && item.image.value ? item.image.value : 'https://via.placeholder.com/50';
      }
    }
  });
  