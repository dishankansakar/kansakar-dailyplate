#!/usr/bin/env python3
"""
Daily Plate — Open Food Facts ingredient builder
================================================
Downloads Australian product data from Open Food Facts (free, no account needed)
and merges it with the built-in USDA-based ingredient list to produce ingredients.js.

Requirements: Python 3.6+ (no extra packages needed — uses stdlib only)

Run:
    python3 build_ingredients.py

Then upload the generated ingredients.js to Netlify alongside your other app files.
Estimated run time: 5-15 minutes depending on internet speed.
"""

import json, time, sys, os, re, math
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError

# ── Configuration ─────────────────────────────────────────────────────────────
MAX_PRODUCTS    = 80_000
PAGE_SIZE       = 1000
MAX_RETRIES     = 5          # retries per page on 503/timeout
RETRY_DELAYS    = [3, 8, 20, 45, 90]   # seconds between retries
REQUEST_TIMEOUT = 40         # seconds per request

BOUNDS = {
    'energy-kcal_100g':     (0, 1000),
    'proteins_100g':        (0, 100),
    'carbohydrates_100g':   (0, 100),
    'fat_100g':             (0, 100),
    'sugars_100g':          (0, 100),
    'fiber_100g':           (0, 100),
    'sodium_100g':          (0, 10),
}

API_FIELDS = ','.join([
    'product_name', 'brands', 'categories_tags',
    'energy-kcal_100g', 'proteins_100g', 'carbohydrates_100g',
    'fat_100g', 'sugars_100g', 'fiber_100g', 'sodium_100g',
])

# Try these API base URLs in order if one fails
API_BASES = [
    'https://world.openfoodfacts.org/cgi/search.pl',
    'https://au.openfoodfacts.org/cgi/search.pl',
]

# ── Built-in USDA ingredients (self-contained — no file dependency) ───────────
def get_builtin_ingredients():
    I = []
    def add(name, cat, cal, p, c, f, sug, fib, sod, uw=None, unit=None, liquid=False, ds=None):
        item = {"name":name,"cat":cat,"cal":cal,"p":p,"c":c,"f":f,"sugar":sug,"fiber":fib,"sodium":sod}
        if uw: item["uw"]=uw; item["unit"]=unit
        if liquid: item["isLiquid"]=True
        if ds: item["defaultServing"]=ds
        I.append(item)

    # FRUITS
    add("Apple, with skin","Fruits",52,0.3,13.8,0.2,10.4,2.4,1,uw=182,unit="apple")
    add("Banana","Fruits",89,1.1,22.8,0.3,12.2,2.6,1,uw=118,unit="banana")
    add("Orange","Fruits",47,0.9,11.8,0.1,9.4,2.4,0,uw=131,unit="orange")
    add("Strawberries","Fruits",32,0.7,7.7,0.3,4.9,2.0,1,uw=12,unit="strawberry")
    add("Blueberries","Fruits",57,0.7,14.5,0.3,10.0,2.4,1)
    add("Raspberries","Fruits",52,1.2,11.9,0.7,4.4,6.5,1,uw=5,unit="raspberry")
    add("Grapes","Fruits",69,0.7,18.1,0.2,15.5,0.9,2,uw=5,unit="grape")
    add("Watermelon","Fruits",30,0.6,7.6,0.2,6.2,0.4,1)
    add("Pineapple","Fruits",50,0.5,13.1,0.1,9.9,1.4,1)
    add("Mango","Fruits",60,0.8,15.0,0.4,13.7,1.6,1,uw=200,unit="mango")
    add("Avocado","Fruits",160,2.0,8.5,14.7,0.7,6.7,7,uw=150,unit="avocado")
    add("Peach","Fruits",39,0.9,9.5,0.3,8.4,1.5,0,uw=147,unit="peach")
    add("Pear","Fruits",57,0.4,15.2,0.1,9.8,3.1,1,uw=166,unit="pear")
    add("Kiwi","Fruits",61,1.1,14.7,0.5,9.0,3.0,3,uw=69,unit="kiwi")
    add("Cherries","Fruits",63,1.1,16.0,0.2,12.8,2.1,0,uw=8,unit="cherry")
    add("Pomegranate","Fruits",83,1.7,18.7,1.2,13.7,4.0,3,uw=282,unit="pomegranate")
    add("Grapefruit","Fruits",42,0.8,10.7,0.1,6.9,1.6,0,uw=246,unit="grapefruit")
    add("Lemon","Fruits",29,1.1,9.3,0.3,2.5,2.8,2,uw=58,unit="lemon")
    add("Lime","Fruits",30,0.7,10.5,0.2,1.7,2.8,2,uw=44,unit="lime")
    add("Plum","Fruits",46,0.7,11.4,0.3,9.9,1.4,0,uw=66,unit="plum")
    add("Apricot","Fruits",48,1.4,11.1,0.4,9.2,2.0,1,uw=35,unit="apricot")
    add("Fig, fresh","Fruits",74,0.8,19.2,0.3,16.3,2.9,1,uw=50,unit="fig")
    add("Dates, dried","Fruits",277,1.8,75.0,0.2,63.4,6.7,2,uw=8,unit="date")
    add("Raisins","Fruits",299,3.1,79.2,0.5,59.2,3.7,11)
    add("Cantaloupe","Fruits",34,0.8,8.2,0.2,7.9,0.9,16)
    add("Papaya","Fruits",43,0.5,10.8,0.3,7.8,1.7,8,uw=304,unit="papaya")
    # VEGETABLES
    add("Broccoli","Vegetables",34,2.8,6.6,0.4,1.7,2.6,33)
    add("Spinach, raw","Vegetables",23,2.9,3.6,0.4,0.4,2.2,79)
    add("Kale, raw","Vegetables",49,4.3,8.8,0.9,2.3,3.6,38)
    add("Carrot","Vegetables",41,0.9,9.6,0.2,4.7,2.8,69,uw=61,unit="carrot")
    add("Tomato","Vegetables",18,0.9,3.9,0.2,2.6,1.2,5,uw=123,unit="medium tomato")
    add("Cucumber","Vegetables",15,0.7,3.6,0.1,1.7,0.5,2)
    add("Bell pepper, red","Vegetables",31,1.0,6.0,0.3,4.2,2.1,4,uw=119,unit="bell pepper")
    add("Onion","Vegetables",40,1.1,9.3,0.1,4.2,1.7,4,uw=110,unit="medium onion")
    add("Garlic","Vegetables",149,6.4,33.1,0.5,1.0,2.1,17,uw=3,unit="clove")
    add("Potato, with skin","Vegetables",77,2.0,17.5,0.1,0.8,2.2,6,uw=150,unit="medium potato")
    add("Sweet potato","Vegetables",86,1.6,20.1,0.1,4.2,3.0,55,uw=130,unit="medium sweet potato")
    add("Lettuce, romaine","Vegetables",17,1.2,3.3,0.3,1.2,2.1,8)
    add("Zucchini","Vegetables",17,1.2,3.1,0.3,2.5,1.0,8,uw=196,unit="zucchini")
    add("Cauliflower","Vegetables",25,1.9,5.0,0.3,1.9,2.0,30)
    add("Mushroom, white","Vegetables",22,3.1,3.3,0.3,2.0,1.0,5,uw=18,unit="mushroom")
    add("Asparagus","Vegetables",20,2.2,3.9,0.1,1.9,2.1,2,uw=16,unit="spear")
    add("Green beans","Vegetables",31,1.8,7.0,0.2,3.3,2.7,6)
    add("Corn, sweet","Vegetables",86,3.3,19.0,1.4,6.3,2.0,15,uw=77,unit="ear (kernels only)")
    add("Peas, green","Vegetables",81,5.4,14.5,0.4,5.7,5.7,5)
    add("Cabbage","Vegetables",25,1.3,5.8,0.1,3.2,2.5,18)
    add("Celery","Vegetables",16,0.7,3.0,0.2,1.3,1.6,80,uw=40,unit="stalk")
    add("Eggplant","Vegetables",25,1.0,5.9,0.2,3.2,3.0,2)
    add("Beet","Vegetables",43,1.6,9.6,0.2,6.8,2.8,78)
    add("Brussels sprouts","Vegetables",43,3.4,9.0,0.3,2.2,3.8,25,uw=19,unit="sprout")
    add("Pumpkin","Vegetables",26,1.0,6.5,0.1,2.8,0.5,1)
    add("Butternut squash","Vegetables",45,1.0,11.7,0.1,2.2,2.0,4)
    # GRAINS
    add("White rice, cooked","Grains",130,2.7,28.2,0.3,0.1,0.4,1)
    add("Brown rice, cooked","Grains",112,2.3,23.5,0.8,0.4,1.8,5)
    add("Quinoa, cooked","Grains",120,4.4,21.3,1.9,0.9,2.8,7)
    add("Oats, rolled, dry","Grains",389,16.9,66.3,6.9,0.99,10.6,2)
    add("Whole wheat bread","Grains",247,13.0,41.0,3.4,5.7,7.0,400,uw=30,unit="slice")
    add("White bread","Grains",265,9.0,49.0,3.2,5.0,2.7,490,uw=30,unit="slice")
    add("Pasta, cooked","Grains",131,5.0,25.0,1.1,0.6,1.8,1)
    add("Whole wheat pasta, cooked","Grains",124,5.3,26.5,1.1,0.8,3.9,4)
    add("Couscous, cooked","Grains",112,3.8,23.2,0.2,0.1,1.4,5)
    add("Barley, cooked","Grains",123,2.3,28.2,0.4,0.3,3.8,3)
    add("Tortilla, flour","Grains",312,8.2,50.2,7.6,2.5,2.6,653,uw=45,unit="tortilla")
    add("Tortilla, corn","Grains",218,5.7,44.6,2.9,0.9,6.3,11,uw=26,unit="tortilla")
    add("Bagel, plain","Grains",257,10.0,50.0,1.7,5.0,2.1,490,uw=98,unit="bagel")
    add("Cornflakes cereal","Grains",357,7.5,84.0,0.4,8.0,3.0,660)
    add("Granola","Grains",471,10.0,64.0,20.0,24.0,7.0,30)
    add("Crackers, saltine","Grains",421,9.5,74.0,11.0,1.0,2.6,1100,uw=3,unit="cracker")
    add("Rice cakes","Grains",387,8.2,81.0,2.8,0.6,4.0,29,uw=9,unit="rice cake")
    # PROTEIN
    add("Chicken breast, skinless, cooked","Protein",165,31.0,0.0,3.6,0.0,0.0,74)
    add("Chicken thigh, skinless, cooked","Protein",209,26.0,0.0,10.9,0.0,0.0,90)
    add("Turkey breast, cooked","Protein",135,30.1,0.0,1.0,0.0,0.0,55)
    add("Beef, ground 85/15, cooked","Protein",250,25.8,0.0,16.9,0.0,0.0,75)
    add("Beef, sirloin steak, cooked","Protein",206,29.0,0.0,9.0,0.0,0.0,56)
    add("Pork chop, cooked","Protein",231,25.7,0.0,13.9,0.0,0.0,62)
    add("Bacon, cooked","Protein",541,37.0,1.4,42.0,0.0,0.0,1717,uw=8,unit="slice")
    add("Salmon, cooked","Protein",206,22.1,0.0,12.4,0.0,0.0,61)
    add("Tuna, canned in water","Protein",116,25.5,0.0,0.8,0.0,0.0,247)
    add("Shrimp, cooked","Protein",99,24.0,0.2,0.3,0.0,0.0,111,uw=15,unit="shrimp")
    add("Tilapia, cooked","Protein",128,26.2,0.0,2.7,0.0,0.0,56)
    add("Cod, cooked","Protein",105,23.0,0.0,0.9,0.0,0.0,78)
    add("Egg, whole, cooked","Protein",155,12.6,1.1,10.6,1.1,0.0,124,uw=50,unit="egg")
    add("Egg white","Protein",52,10.9,0.7,0.2,0.7,0.0,166,uw=33,unit="egg white")
    add("Tofu, firm","Protein",144,15.7,2.8,8.7,0.6,2.3,12)
    add("Tempeh","Protein",193,20.3,7.6,11.0,0.0,0.0,9)
    add("Lentils, cooked","Protein",116,9.0,20.1,0.4,1.8,7.9,2)
    add("Chickpeas, cooked","Protein",164,8.9,27.4,2.6,4.8,7.6,7)
    add("Black beans, cooked","Protein",132,8.9,23.7,0.5,0.3,8.7,1)
    add("Kidney beans, cooked","Protein",127,8.7,22.8,0.5,0.3,6.4,2)
    add("Edamame","Protein",121,11.9,8.9,5.2,2.2,5.2,6)
    add("Ham, sliced","Protein",145,21.0,1.5,5.5,1.5,0.0,1203,uw=28,unit="slice")
    add("Turkey bacon","Protein",150,19.0,1.5,7.0,0.5,0.0,920,uw=14,unit="slice")
    add("Sausage, pork","Protein",301,12.0,2.0,27.0,0.0,0.0,820,uw=45,unit="link")
    # DAIRY
    add("Milk, whole","Dairy",61,3.2,4.8,3.3,5.1,0.0,43,liquid=True,ds=240)
    add("Milk, skim","Dairy",34,3.4,5.0,0.1,5.1,0.0,42,liquid=True,ds=240)
    add("Milk, 2%","Dairy",50,3.3,4.9,2.0,5.1,0.0,44,liquid=True,ds=240)
    add("Greek yogurt, plain, nonfat","Dairy",59,10.2,3.6,0.4,3.2,0.0,36)
    add("Yogurt, plain, whole milk","Dairy",61,3.5,4.7,3.3,4.7,0.0,46)
    add("Cheddar cheese","Dairy",403,24.9,1.3,33.1,0.5,0.0,621,uw=28,unit="slice (28g)")
    add("Mozzarella cheese","Dairy",280,27.5,2.2,17.1,1.0,0.0,627)
    add("Parmesan cheese","Dairy",431,38.5,4.1,28.6,0.9,0.0,1529)
    add("Cottage cheese","Dairy",98,11.1,3.4,4.3,2.7,0.0,364)
    add("Cream cheese","Dairy",342,6.2,4.1,34.2,3.2,0.0,321)
    add("Butter","Dairy",717,0.9,0.1,81.1,0.1,0.0,11)
    add("Sour cream","Dairy",198,2.4,4.6,19.4,2.5,0.0,31)
    add("Heavy cream","Dairy",340,2.8,2.8,36.1,2.9,0.0,38,liquid=True,ds=30)
    add("Almond milk, unsweetened","Dairy",17,0.6,0.6,1.5,0.0,0.5,63,liquid=True,ds=240)
    add("Oat milk","Dairy",47,1.0,7.5,1.5,4.0,0.8,60,liquid=True,ds=240)
    add("Soy milk, unsweetened","Dairy",33,3.3,1.8,1.8,0.5,0.6,51,liquid=True,ds=240)
    # NUTS / SEEDS / FATS
    add("Almonds","Nuts & Seeds",579,21.2,21.6,49.9,4.4,12.5,1,uw=1.2,unit="almond")
    add("Walnuts","Nuts & Seeds",654,15.2,13.7,65.2,2.6,6.7,2,uw=7,unit="walnut half")
    add("Peanuts","Nuts & Seeds",567,25.8,16.1,49.2,4.7,8.5,18)
    add("Peanut butter","Nuts & Seeds",588,25.1,20.0,50.4,9.2,6.0,459)
    add("Almond butter","Nuts & Seeds",614,21.0,18.8,55.5,4.3,10.3,7)
    add("Cashews","Nuts & Seeds",553,18.2,30.2,43.9,5.9,3.3,12,uw=1.5,unit="cashew")
    add("Pistachios","Nuts & Seeds",560,20.2,27.2,45.3,7.7,10.6,1,uw=0.9,unit="pistachio")
    add("Chia seeds","Nuts & Seeds",486,16.5,42.1,30.7,0.0,34.4,16)
    add("Flaxseed","Nuts & Seeds",534,18.3,28.9,42.2,1.6,27.3,30)
    add("Pumpkin seeds","Nuts & Seeds",559,30.2,10.7,49.1,1.4,6.0,7)
    add("Sunflower seeds","Nuts & Seeds",584,20.8,20.0,51.5,2.6,8.6,9)
    add("Olive oil","Fats & Oils",884,0.0,0.0,100.0,0.0,0.0,2,liquid=True,ds=15)
    add("Coconut oil","Fats & Oils",862,0.0,0.0,100.0,0.0,0.0,0,liquid=True,ds=15)
    add("Vegetable oil","Fats & Oils",884,0.0,0.0,100.0,0.0,0.0,0,liquid=True,ds=15)
    add("Avocado oil","Fats & Oils",884,0.0,0.0,100.0,0.0,0.0,0,liquid=True,ds=15)
    add("Coconut, shredded, unsweetened","Nuts & Seeds",660,6.9,23.7,64.5,7.4,16.3,37)
    # SNACKS / SWEETS
    add("Dark chocolate, 70-85%","Snacks & Sweets",598,7.8,45.9,42.6,24.0,10.9,20,uw=10,unit="square")
    add("Milk chocolate","Snacks & Sweets",535,7.7,59.4,29.7,51.5,3.4,79,uw=10,unit="square")
    add("Potato chips","Snacks & Sweets",536,7.0,53.0,34.6,0.4,4.4,525)
    add("Tortilla chips","Snacks & Sweets",489,7.0,63.0,24.0,0.6,4.4,400)
    add("Popcorn, air-popped","Snacks & Sweets",387,12.9,77.8,4.5,0.9,14.5,8)
    add("Pretzels","Snacks & Sweets",380,10.0,80.0,2.6,2.0,3.0,1240)
    add("Ice cream, vanilla","Snacks & Sweets",207,3.5,23.6,11.0,21.2,0.7,80)
    add("Cookies, chocolate chip","Snacks & Sweets",488,5.3,64.0,24.3,38.0,2.5,358,uw=16,unit="cookie")
    add("Donut, glazed","Snacks & Sweets",452,5.0,51.0,25.0,23.0,1.5,373,uw=49,unit="donut")
    add("Honey","Snacks & Sweets",304,0.3,82.4,0.0,82.1,0.2,4)
    add("Maple syrup","Snacks & Sweets",260,0.0,67.0,0.2,60.0,0.0,12)
    add("Sugar, white","Snacks & Sweets",387,0.0,100.0,0.0,100.0,0.0,1)
    add("Jam, fruit","Snacks & Sweets",250,0.4,65.0,0.1,62.0,0.8,30)
    add("Granola bar","Snacks & Sweets",471,10.0,64.0,20.0,24.0,7.0,30,uw=47,unit="bar")
    add("Pancake, plain","Snacks & Sweets",227,6.0,28.0,9.0,6.0,1.0,439,uw=38,unit="pancake")
    add("Waffle, plain","Snacks & Sweets",291,7.9,36.0,13.0,3.0,1.5,615,uw=75,unit="waffle")
    # BEVERAGES
    add("Coffee, black","Beverages",2,0.3,0.0,0.0,0.0,0.0,2,liquid=True,ds=240)
    add("Tea, unsweetened","Beverages",1,0.0,0.3,0.0,0.0,0.0,1,liquid=True,ds=240)
    add("Orange juice","Beverages",45,0.7,10.4,0.2,8.4,0.2,1,liquid=True,ds=240)
    add("Apple juice","Beverages",46,0.1,11.3,0.1,9.6,0.2,4,liquid=True,ds=240)
    add("Cola soda","Beverages",41,0.0,10.6,0.0,10.6,0.0,4,liquid=True,ds=355)
    add("Beer","Beverages",43,0.5,3.6,0.0,0.0,0.0,4,liquid=True,ds=355)
    add("Red wine","Beverages",85,0.1,2.6,0.0,0.6,0.0,4,liquid=True,ds=150)
    add("White wine","Beverages",82,0.1,2.6,0.0,1.0,0.0,5,liquid=True,ds=150)
    add("Energy drink","Beverages",45,0.0,11.0,0.0,11.0,0.0,80,liquid=True,ds=250)
    add("Coconut water","Beverages",19,0.7,3.7,0.2,2.6,1.1,105,liquid=True,ds=240)
    add("Smoothie, fruit, store-bought","Beverages",60,0.8,14.5,0.2,12.0,1.0,10,liquid=True,ds=300)
    # PREPARED / FAST FOOD
    add("Pizza, cheese, slice (avg)","Prepared & Fast Food",266,11.0,33.0,10.0,3.8,2.3,598,uw=107,unit="slice")
    add("Hamburger, fast food","Prepared & Fast Food",295,17.0,29.0,13.0,6.0,1.5,470,uw=110,unit="burger")
    add("Cheeseburger, fast food","Prepared & Fast Food",303,15.0,30.0,14.0,6.0,1.5,680,uw=113,unit="cheeseburger")
    add("French fries","Prepared & Fast Food",312,3.4,41.0,15.0,0.3,3.8,210)
    add("Chicken nuggets","Prepared & Fast Food",296,15.0,17.0,19.0,0.3,1.0,540,uw=16,unit="nugget")
    add("Sushi roll, california","Prepared & Fast Food",145,5.8,22.0,3.8,4.0,1.5,320,uw=28,unit="piece")
    add("Burrito, bean and cheese","Prepared & Fast Food",206,8.5,28.0,7.0,1.0,4.0,460,uw=217,unit="burrito")
    add("Taco, beef","Prepared & Fast Food",226,11.5,15.0,13.5,1.0,2.5,397,uw=89,unit="taco")
    add("Caesar salad with chicken","Prepared & Fast Food",158,15.0,5.0,9.0,1.5,1.5,400)
    add("Fried rice","Prepared & Fast Food",163,4.5,24.0,5.0,1.0,1.0,380)
    add("Pad thai","Prepared & Fast Food",170,7.0,22.0,6.0,5.0,1.5,500)
    add("Ramen, instant, prepared","Prepared & Fast Food",436,10.0,67.0,14.0,2.0,2.0,1700,uw=87,unit="block (dry)")
    add("Pho, beef","Prepared & Fast Food",90,7.0,11.0,2.0,1.0,0.5,400)
    add("Sandwich, turkey, deli","Prepared & Fast Food",230,15.0,30.0,5.0,4.0,2.5,800,uw=230,unit="sandwich")
    add("Hot dog, with bun","Prepared & Fast Food",290,10.4,24.0,17.0,4.0,1.0,810,uw=98,unit="hot dog")
    add("Mac and cheese","Prepared & Fast Food",164,6.4,20.0,6.6,2.0,0.8,449)
    add("Lasagna, meat","Prepared & Fast Food",135,8.5,11.0,6.5,3.0,1.0,380)
    add("Quesadilla, cheese","Prepared & Fast Food",289,12.0,25.0,16.0,1.5,1.5,580,uw=115,unit="quesadilla")
    add("Falafel","Prepared & Fast Food",333,13.3,31.8,17.8,1.9,4.9,294,uw=17,unit="falafel ball")
    add("Hummus","Prepared & Fast Food",166,7.9,14.3,9.6,0.0,6.0,379)
    add("Guacamole","Prepared & Fast Food",157,2.0,8.5,14.7,0.7,6.0,250)
    add("French toast","Prepared & Fast Food",229,7.9,25.0,11.0,8.0,1.0,350,uw=65,unit="slice")
    add("Omelette, cheese","Prepared & Fast Food",184,12.7,1.5,14.5,1.0,0.0,260,uw=120,unit="omelette")
    add("Stir fry, vegetable and chicken","Prepared & Fast Food",120,9.0,8.0,6.0,3.0,2.0,400)
    add("Soup, chicken noodle","Prepared & Fast Food",38,2.6,4.6,1.0,0.5,0.5,380,liquid=True,ds=240)
    add("Curry, chicken with rice","Prepared & Fast Food",150,9.0,15.0,6.0,2.0,1.0,420)
    return I

# ── Helpers ───────────────────────────────────────────────────────────────────
def safe_float(val, lo, hi):
    try:
        v = float(val)
        return round(v, 2) if lo <= v <= hi else None
    except (TypeError, ValueError):
        return None

def clean_name(name, brand):
    name = re.sub(r'\s+', ' ', (name or '').strip())
    brand = (brand or '').strip()
    if brand and brand.lower() not in name.lower() and len(brand) < 40:
        name = f"{brand} — {name}"
    return name[:80] + ('...' if len(name) > 80 else '')

def infer_category(tags):
    if not tags: return 'Other'
    s = ' '.join(tags).lower()
    if any(x in s for x in ['beverage','drink','juice','coffee','tea','wine','beer','soda','smoothie']): return 'Beverages'
    if any(x in s for x in ['dairy','cheese','yogurt','cream','butter','milk']): return 'Dairy'
    if any(x in s for x in ['meat','poultry','chicken','beef','pork','fish','seafood','egg']): return 'Protein'
    if any(x in s for x in ['bread','cereal','pasta','rice','grain','flour','cracker','noodle','oat']): return 'Grains'
    if any(x in s for x in ['fruit','apple','banana','berry','citrus','mango','grape']): return 'Fruits'
    if any(x in s for x in ['vegetable','veggie','salad','potato','carrot','broccoli','tomato']): return 'Vegetables'
    if any(x in s for x in ['nut','seed','almond','cashew','peanut','walnut']): return 'Nuts & Seeds'
    if any(x in s for x in ['oil','fat','margarine']): return 'Fats & Oils'
    if any(x in s for x in ['snack','chip','biscuit','cookie','chocolate','candy','sweet','cake','ice-cream','confection']): return 'Snacks & Sweets'
    if any(x in s for x in ['sauce','condiment','dressing','spread','jam','paste','pickle']): return 'Condiments & Sauces'
    if any(x in s for x in ['frozen','ready','pizza','prepared','soup','meal']): return 'Prepared & Fast Food'
    return 'Other'

def is_liquid(tags):
    if not tags: return False
    s = ' '.join(tags).lower()
    return any(x in s for x in ['beverage','drink','juice','liquid','oil','milk','smoothie','coffee','tea','wine','beer','water'])

def process_product(p):
    name_raw = (p.get('product_name') or '').strip()
    if not name_raw or len(name_raw) < 2: return None
    cal  = safe_float(p.get('energy-kcal_100g'), *BOUNDS['energy-kcal_100g'])
    prot = safe_float(p.get('proteins_100g'),    *BOUNDS['proteins_100g'])
    carb = safe_float(p.get('carbohydrates_100g'), *BOUNDS['carbohydrates_100g'])
    fat  = safe_float(p.get('fat_100g'),         *BOUNDS['fat_100g'])
    if any(v is None for v in [cal, prot, carb, fat]): return None
    # Macro/calorie sanity check
    macro_cal = prot*4 + carb*4 + fat*9
    if cal > 10 and macro_cal > 0:
        ratio = cal / macro_cal
        if ratio < 0.35 or ratio > 2.8: return None
    sug  = safe_float(p.get('sugars_100g'),  *BOUNDS['sugars_100g'])  or 0.0
    fib  = safe_float(p.get('fiber_100g'),   *BOUNDS['fiber_100g'])   or 0.0
    sod_g = safe_float(p.get('sodium_100g'), *BOUNDS['sodium_100g'])
    sod  = round(sod_g * 1000) if sod_g else 0
    tags = p.get('categories_tags') or []
    cat  = infer_category(tags)
    liq  = is_liquid(tags)
    item = {'name': clean_name(name_raw, p.get('brands','')),
            'cat': cat, 'cal': cal, 'p': prot, 'c': carb, 'f': fat,
            'sugar': sug, 'fiber': fib, 'sodium': sod, 'src': 'off'}
    if liq:
        item['isLiquid'] = True
        item['defaultServing'] = 240
    return item

def deduplicate(off_items, builtin_names):
    seen = set(n.lower() for n in builtin_names)
    out = []
    for item in off_items:
        k = item['name'].lower().strip()
        if k not in seen:
            seen.add(k)
            out.append(item)
    return out

# ── Fetch with retry ──────────────────────────────────────────────────────────
def fetch_page(page, base_url):
    params = {
        'action': 'process',
        'tagtype_0': 'countries', 'tag_contains_0': 'contains', 'tag_0': 'australia',
        'fields': API_FIELDS,
        'page_size': PAGE_SIZE, 'page': page,
        'json': '1', 'sort_by': 'unique_scans_n',
    }
    url = base_url + '?' + urlencode(params)
    headers = {'User-Agent': 'DailyPlateApp/1.0 (personal nutrition tracker; contact via github)'}
    for attempt in range(MAX_RETRIES):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=REQUEST_TIMEOUT) as r:
                return json.loads(r.read().decode('utf-8', errors='replace'))
        except HTTPError as e:
            wait = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS)-1)]
            if e.code in (429, 503, 502, 504):
                print(f"\n  Server busy (HTTP {e.code}). Waiting {wait}s before retry {attempt+1}/{MAX_RETRIES}...")
                time.sleep(wait)
            else:
                print(f"\n  HTTP {e.code} on page {page} — skipping.")
                return None
        except (URLError, TimeoutError, OSError) as e:
            wait = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS)-1)]
            print(f"\n  Network error: {e}. Waiting {wait}s before retry {attempt+1}/{MAX_RETRIES}...")
            time.sleep(wait)
    print(f"\n  Gave up on page {page} after {MAX_RETRIES} retries.")
    return None

def fetch_all(base_url):
    print(f"  Using API: {base_url}")
    all_products, page, total_pages = [], 1, None
    while len(all_products) < MAX_PRODUCTS:
        sys.stdout.write(f"  Page {page}/{total_pages or '?'} — {len(all_products)} products collected...\r")
        sys.stdout.flush()
        data = fetch_page(page, base_url)
        if not data:
            if page == 1:
                return None   # Signal to try next base URL
            break
        products = data.get('products', [])
        if not products:
            break
        all_products.extend(products)
        count = data.get('count', 0)
        total_pages = max(1, math.ceil(count / PAGE_SIZE))
        if page >= total_pages or len(all_products) >= MAX_PRODUCTS:
            break
        page += 1
        time.sleep(1.5)
    print(f"\n  Collected {len(all_products)} raw products.")
    return all_products

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Daily Plate — Ingredient Database Builder")
    print("==========================================\n")

    builtins = get_builtin_ingredients()
    print(f"Built-in USDA ingredients: {len(builtins)}\n")

    print("── Fetching Australian products from Open Food Facts ──")
    print("This may take 5-15 minutes. Please keep this window open.\n")

    raw_products = None
    for base_url in API_BASES:
        raw_products = fetch_all(base_url)
        if raw_products is not None:
            break
        print(f"  Trying next server...\n")

    if not raw_products:
        print("\n⚠  Could not reach Open Food Facts API.")
        print("   Check your internet connection and try again.")
        print("   The app will still work with the built-in ingredients only.")
        raw_products = []

    print("\n── Filtering for quality ──")
    off_items, skipped = [], 0
    for p in raw_products:
        item = process_product(p)
        if item: off_items.append(item)
        else: skipped += 1
    print(f"  Passed: {len(off_items)}  |  Skipped (incomplete/invalid): {skipped}")

    off_items = deduplicate(off_items, [i['name'] for i in builtins])
    print(f"  After dedup: {len(off_items)}")

    all_items = builtins + off_items
    print(f"\n── Final database ──")
    print(f"  {len(builtins):,} built-in (USDA)")
    print(f"  {len(off_items):,} from Open Food Facts (Australia)")
    print(f"  {len(all_items):,} total\n")

    script_dir = os.path.dirname(os.path.abspath(__file__))

    json_path = os.path.join(script_dir, 'ingredients.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(all_items, f, separators=(',',':'), ensure_ascii=False)
    print(f"✓ ingredients.json  ({os.path.getsize(json_path)/1024/1024:.1f} MB)")

    js_path = os.path.join(script_dir, 'ingredients.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('const INGREDIENTS=')
        json.dump(all_items, f, separators=(',',':'), ensure_ascii=False)
        f.write(';')
    print(f"✓ ingredients.js    ({os.path.getsize(js_path)/1024/1024:.1f} MB)")
    print("\nUpload ingredients.js to Netlify alongside your other app files.")
    print("Done! ✓")

if __name__ == '__main__':
    main()
