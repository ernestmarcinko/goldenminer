var buildings = new Object();

buildings = {
  0 : {
    name: 'School of the Legends',
    description: 'In return for funds, this shool will produce a random Legendary item for you in 30 minutes. <br><br><span class="warning">(This effect is not permanent: <br>1 fund = 1 item)</span><br><br> 5 funds maximum at once.',
    slots: 5,
    currency: 0,
    type: 0,
    priceModifier: 1
  },
  1 : {
    name: 'School of the Alchemists',
    description: 'In return for funds, this shool will produce a random Potion for you in 30 minutes. <br><br><span class="warning">(This effect is not permanent: <br>1 fund = 1 item)</span><br><br> 5 funds maximum at once.',
    slots: 5,
    currency: 0,
    type: 0,
    priceModifier: 1.4
  },          
  2 : {
    name: 'School of Knowledge',
    description: 'In return for funds, this shool will produce a random Scroll for you in 30 minutes. <br><br><span class="warning">(This effect is not permanent: <br>1 fund = 1 item)</span><br><br> 5 funds maximum at once.',
    slots: 5,
    currency: 1,
    type: 0,
    priceModifier: 1.9
  },          
  3 : {
    name: 'Temple of Golden knowledge',
    description: 'In return for 1 trilion gold sacrifice, this temple will grant you +1xp/second permanently.',
    slots: 5,
    currency: 0,
    type: 1,
    xpBonus: 1,
    price: 1000000000000
  },          
  4 : {
    name: 'Temple of Diamond knowledge',
    description: 'In return for 1 trilion diamonds sacrifice, this temple will grant you +1xp/second permanently.',
    slots: 5,
    currency: 1,
    type: 1,
    xpBonus: 1,
    price: 1000000000000
  }
};