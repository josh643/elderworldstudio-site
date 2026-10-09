"""Merch page config. This is the ONLY file to edit when the store opens.
- STORE_URL: the shop's home page (e.g. "https://elderworldstudio.fourthwall.com"). None = "Coming soon" mode.
- Each product's "url": its product page in the store. None = falls back to STORE_URL (or "Notify me" while STORE_URL is None).
Then run: tools/deploy-cf.sh   (rebuilds and deploys)."""
STORE_URL = None
STORE_NAME = "Fourthwall"
NOTIFY_EMAIL = "unity@elderworldsstudio.com"
PRODUCTS = [
    {"id": "crest-tee", "name": "Elder World Crest Tee", "price": "$26", "game": "Elder World Studio",
     "img": "crest-tee.jpg", "desc": "Our gold crest and \u201cForging Digital Realms\u201d on a soft black Bella+Canvas tee.", "url": None},
    {"id": "omnivael-tee", "name": "Omnivael \u201cNo Chosen One\u201d Tee", "price": "$26", "game": "Omnivael: Wayfarers Life",
     "img": "omnivael-tee.jpg", "desc": "No Chosen One. No war to win. Just a world to live in. The Wayfarers Life motto in gold.", "url": None},
    {"id": "shuttle-tee", "name": "Star Wayfarer Shuttle Tee", "price": "$26", "game": "Star Wayfarer",
     "img": "shuttle-tee.jpg", "desc": "The Wayfarer shuttle from Star Wayfarer, rendered from the in-game model.", "url": None},
    {"id": "crest-hoodie", "name": "Elder World Crest Hoodie", "price": "$48", "game": "Elder World Studio",
     "img": "crest-hoodie.jpg", "desc": "Big crest on the back, small crest on the chest. Heavy blend, double-lined hood.", "url": None},
    {"id": "wave-mug", "name": "\u201cJust One More Wave\u201d Mug", "price": "$16", "game": "Chronicles of the Realm",
     "img": "wave-mug.jpg", "desc": "11 oz glossy mug for the arena regulars of Chronicles of the Realm.", "url": None},
    {"id": "stickers", "name": "Die-Cut Stickers", "price": "$5 each", "game": "All games",
     "img": "stickers.jpg", "desc": "3-inch vinyl stickers: the crest, the Wayfarer shuttle and the Omnivael badge.", "url": None},
]
