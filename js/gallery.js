// Simple gallery lightbox: click an image to open, navigate with prev/next, Esc to close
const grid = document.getElementById('gallery-grid')
const lightbox = document.getElementById('lightbox')
const lightboxImg = document.getElementById('lightbox-img')
const closeBtn = document.querySelector('.lightbox-close')
const prevBtn = document.querySelector('.lightbox-prev')
const nextBtn = document.querySelector('.lightbox-next')

let currentIndex = -1
let images = []

function openLightbox(index){
  currentIndex = index
  const src = images[currentIndex].dataset.src || images[currentIndex].src
  lightboxImg.src = src
  lightboxImg.alt = images[currentIndex].alt || ''
  lightbox.classList.add('show')
  lightbox.setAttribute('aria-hidden','false')
}

function closeLightbox(){
  lightbox.classList.remove('show')
  lightbox.setAttribute('aria-hidden','true')
  lightboxImg.src = ''
}

function showPrev(){
  if(currentIndex <= 0) currentIndex = images.length - 1
  else currentIndex--
  openLightbox(currentIndex)
}

function showNext(){
  if(currentIndex >= images.length - 1) currentIndex = 0
  else currentIndex++
  openLightbox(currentIndex)
}

if(grid){
  images = Array.from(grid.querySelectorAll('img'))
  images.forEach((img, i) => {
    img.addEventListener('click', () => openLightbox(i))
    img.tabIndex = 0
    img.addEventListener('keydown', (e) => { if(e.key === 'Enter') openLightbox(i) })
  })
}

closeBtn.addEventListener('click', closeLightbox)
prevBtn.addEventListener('click', showPrev)
nextBtn.addEventListener('click', showNext)

lightbox.addEventListener('click', (e) => {
  if(e.target === lightbox) closeLightbox()
})

document.addEventListener('keydown', (e) => {
  if(lightbox.classList.contains('show')){
    if(e.key === 'Escape') closeLightbox()
    if(e.key === 'ArrowLeft') showPrev()
    if(e.key === 'ArrowRight') showNext()
  }
})
