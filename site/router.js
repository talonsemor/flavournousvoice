// site/router.js
function navigate(){
  const hash = location.hash || '#/'
  const main = document.getElementById('main')
  if(hash.startsWith('#/album/')){
    const title = decodeURIComponent(hash.split('/').slice(2).join('/'))
    main.innerHTML = `<div class="card"><h2>Album: ${title}</h2><div id="albumGrid" class="grid"></div></div>`
    loadAlbum(title)
  }else{
    main.innerHTML = '<section class="card"><h2>Latest Media</h2><div id="grid" class="grid"></div></section>'
    loadMedia()
  }
}
window.addEventListener('hashchange', navigate)
window.addEventListener('load', navigate)