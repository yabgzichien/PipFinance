#!/usr/bin/env python3
"""
Dataset Generator & Enricher for Pip Finance Classifier.
Generates an expanded, balanced, multilingual (English, Malay, Chinese) dataset
covering all 16 expense and income categories with real-world merchants, colloquial phrases,
and common typos.
"""

import json
import os
import random

DATA_RAW = {
    "food": [
        # Fast Food
        "McDonald's McValue meal", "McD breakfast hashbrown coffee", "McDonalds drive thru spicy chicken",
        "KFC dinner plate combo", "KFC zinger burger box", "Kentucky Fried Chicken lunch",
        "Burger King Whopper meal", "Texas Chicken 2pc combo honey butter biscuit",
        "Subway 6-inch roasted chicken", "Subway footlong tuna sub",
        "Marrybrown crispy chicken nasi lemak", "A&W root beer waffle float",
        "4Fingers crispy chicken drumsticks", "KyoChon soy garlic wings",
        "Jollibee chickenjoy with spaghetti", "Carl's Jr charbroiled burger",
        "Wendy's beef burger fries", "Shake Shack double shackburger", "Five Guys burger milkshake",
        # Coffee & Cafes
        "Starbucks iced caramel macchiato", "Starbucks Reserve pour over", "Starbucks cold brew",
        "Starbucks matcha latte pastry", "Starbucks frappuccino java chip",
        "Zus Coffee Spanish latte", "Zus Coffee buttercrust pastry", "Zus iced americano",
        "Gigi Coffee buttercream latte", "Gigi caffe latte",
        "Bask Bear Coffee toastie combo", "Bask Bear iced latte",
        "The Coffee Bean & Tea Leaf hazelnut iced blend", "CBTL cafe latte bagel",
        "Kenangan Coffee avocado coffee", "Kenangan kopi kenangan mantan",
        "Luckin Coffee coconut latte", "Luckin velvety latte",
        "% Arabica Kyoto iced latte", "HWC Coffee specialty drip coffee",
        "San Francisco Coffee caffe mocha", "Costa Coffee flat white",
        # Boba & Drinks
        "Chagee fresh milk tea white peach oolong", "Chagee Da Hong Pao milk tea",
        "Tealive signature brown sugar pearl milk tea", "Tealive sparkling fruit tea",
        "Mixue boba sundae ice cream", "Mixue fresh squeezed lemonade", "Mixue peach four seasons spring",
        "Gong Cha pearl milk tea herbal jelly", "KOI The golden bubble milk tea",
        "The Alley brown sugar deerioca", "Tiger Sugar brown sugar boba fresh milk",
        "Chatime grass jelly roasted milk tea", "Daboba roasted brown sugar milk tea",
        # Hawker & Kopitiam
        "Nasi lemak ayam goreng panas", "Roti canai telur bawang sambal", "Roti telur mamak teh tarik",
        "Teh tarik kurang manis mamak", "Kopi o peng kaw kopitiam", "Cham peng iced kopitiam",
        "Roti bakar kaya butter telur separuh masak", "Char kway teow kerang extra pedas",
        "Hainanese chicken rice roasted breast", "Penang white curry mee", "Sarawak laksa bihun",
        "Chili pan mee dry poached egg", "Traditional pan mee soup handmade noodles",
        "Wantan mee char siew wantan soup", "Klang bak kut teh herbal soup ribs",
        "Dim sum siew mai har gow chee cheong fun", "Ipoh hor fun shredded chicken prawn",
        "Mee goreng mamak ayam telur mata", "Maggi goreng mamak telur goyang",
        "Economy rice chap fan 3 dishes", "Mixed rice 2 vegetables 1 meat",
        "Nasi kandar ayam madu bendi telur masin", "Nasi padang rendang daging sambal hijau",
        "Satay kajang 20 cucuk kuah kacang", "Ikan bakar petai sambal nasi putih",
        "Tomyam seafood sup campur nasi putih", "Sup tulang kambing roti benggali",
        "Pisang goreng cheese leleh", "Cendol durian santan gula melaka",
        "Rojak buah kuah petis kacang", "Apam balik kacang jagung manis",
        # Restaurants & Casual Dining
        "Din Tai Fung xiao long bao egg fried rice", "Din Tai Fung pork chop noodles",
        "Haidilao hotpot tomato soup beef slices", "Haidilao steamboat supper",
        "Beauty in The Pot collagen broth hotpot", "Suki-Ya shabu shabu buffet",
        "Seoul Garden korean BBQ buffet", "Bar.B.Q Plaza pork set meal",
        "Sushi Zanmai salmon sashimi roll", "Sushi King bonanza plate",
        "Genki Sushi kousoku train sushi", "Ichiban Ramen tonkotsu ramen chashu",
        "Ippudo ramen akamaru shinaji", "Nando's 1/4 chicken peri peri hot peri chips",
        "Tony Roma's BBQ ribs mashed potato", "Chili's cajun chicken pasta",
        "The Daily Grind gourmet burger", "Kenny Rogers Roasters quarter meal",
        "Secret Recipe tomyam spaghetti chicken", "Secret Recipe whole cake celebration",
        # Bakeries & Desserts
        "Lavender bakery butter loaf cranberry bread", "RT Pastry matcha sponge roll",
        "BreadTalk floss bun sausage bread", "Komugi hanzuku cheesecake",
        "Tous Les Jours baguette almond croissant", "Auntie Anne's pretzel cinnamon sugar",
        "Famous Amos chocolate chip cookies 200g", "Inside Scoop durian ice cream waffle",
        "Baskin Robbins pint strawberry ice cream", "Haagen-Dazs tub Belgian chocolate",
        "llaollao sanum frozen yogurt fruits", "Chateraise cream puff strawberry shortcake",
        # Groceries & Supermarkets
        "Jaya Grocer fresh milk organic vegetables", "Jaya Grocer imported fruits ribeye",
        "Village Grocer weekly fresh produce", "Lotus's weekly grocery shopping eggs rice",
        "99 Speedmart cooking oil eggs bread sugar", "99 Speedmart mineral water detergent",
        "Aeon Supermarket salmon fillet sushi pack", "Aeon Big household grocery flour onions",
        "Giant Hypermarket pantry restock canned food", "HeroMarket fresh chicken vegetables",
        "NSK Trade City wholesale vegetables seafood", "Ben's Independent Grocer pantry staples",
        "Pasar pagi fresh pork fish vegetables wet market", "Pasar malam street food snacks skewers",
        # Food Delivery
        "GrabFood lunch delivery order", "GrabFood dinner burger fries",
        "Foodpanda rider delivery mamak supper", "Foodpanda grocery pandamart milk",
        "ShopeeFood boba tea promo delivery", "airasia food lunch promo set",
        # Chinese Terms
        "星巴克冰美式咖啡", "全家便利店关东煮", "麦当劳双层牛肉汉堡", "肯德基炸鸡套餐",
        "霸王茶姬伯牙绝弦奶茶", "蜜雪冰城柠檬水圣代", "海底捞火锅肥牛羊肉", "鼎泰丰小笼包蛋炒饭",
        "点心烧卖虾饺肠粉", "肉骨茶排骨猪脚汤", "海南鸡饭烧鸡饭", "板面辣椒板面幼面",
        "炒粿条加蛋鲜蛤", "杂饭经济饭两菜一肉", "麻辣烫自助火锅", "潮州粥白粥小菜",
        "烘焙坊切片面包羊角包", "九九超市买菜买蛋食用油", "生鲜超市买三文鱼牛肉", "大山脚鸭饭叉烧",
        "外卖点餐午餐配送", "茶餐室咖啡冰烤面包生熟蛋", "擂茶客家擂茶糙米", "瓦煲鸡饭腊肠鸡肉",
        # Malay Phrases
        "Makan tengahari kedai tomyam", "Sarapan pagi nasi lemak bungkus",
        "Bungkus lauk tengahari pasar malam", "Makan malam sekeluarga restoran",
        "Minum petang teh tarik pisang goreng", "Supper mamak roti tisu milo ais"
    ],

    "travelling": [
        # Petrol / Fuel
        "Petronas Primax 95 fuel refill", "Petronas Primax 97 petrol pump",
        "Petronas Dynamic Diesel refill", "Petronas Mesra fuel payment",
        "Shell FuelSave 95 isi minyak kereta", "Shell V-Power Racing petrol",
        "Shell fuel pump petrol 95", "Caltex Techron with Clean & Glide 95",
        "Caltex petrol pump RON97", "BHPetrol Infiniti RON95 euro 5",
        "Petron Blaze 95 fuel pump", "Petron Blaze 100 high octane petrol",
        "Isi minyak motor Shell RM10", "Isi minyak kereta Petronas full tank",
        "Stesen minyak isi diesel kenderaan", "Petrol pump payment card RON95",
        # Public Transit & Tolls
        "Touch 'n Go reload eWallet RFID", "TnG card reload counter LRT",
        "Touch n Go NFC reload transit card", "RFID tag toll reload PLUS highway",
        "RapidKL LRT token Kelana Jaya line", "RapidKL MRT Kajang line transit token",
        "RapidKL MRT Putrajaya line ticket", "Monorail ticket KL Sentral to Bukit Bintang",
        "KTM Komuter train ticket Mid Valley", "KTM ETS electric train ticket Ipoh KL",
        "KLIA Ekspres airport train ticket single", "KLIA Transit ticket Bandar Tasik Selatan",
        "Terminal Bersepadu Selatan bus ticket Penang", "Rapid bus fare payment cash card",
        "Plus Highway toll plaza payment", "SMART tunnel toll charge",
        "MEX Maju Expressway toll charge", "LDP Damansara Puchong highway toll",
        "DUKE highway toll plaza entry", "KESAS highway toll plaza booth",
        "Sprint highway toll Kerinchi link", "Penang Bridge toll RFID Touch n Go",
        # Ride Hailing & Taxis
        "Grab car ride to office KLCC", "Grab ride airport transit KLIA",
        "GrabCar 6-seater family ride", "GrabCar premium airport pickup",
        "AirAsia Ride booking to central", "Maxim taxi ride home",
        "inDrive ride negotiated fare", "Metered taxi red white cab KL",
        "Airport taxi counter coupon voucher", "Chauffeur transfer hotel limousine",
        # Parking
        "Shopping mall basement parking ticket", "Mid Valley parking ticket autodebit",
        "Pavilion KL valet parking fee", "Sunway Pyramid parking TnG tap",
        "JomParking street parking session MBPJ", "FlexiParking DBKL street parking voucher",
        "Smart Selangor Parking coupon reload", "Season parking monthly pass office building",
        "Touch n Go parking surcharge exit", "Valet service premium parking bay",
        # Flights & Hotels / Travel
        "AirAsia domestic flight ticket Langkawi", "AirAsia international return flight Bangkok",
        "Malaysia Airlines MAS flight ticket Kota Kinabalu", "Batik Air return ticket Bali",
        "Scoot budget flight Singapore", "Singapore Airlines flight ticket Tokyo",
        "Cathay Pacific return flight Hong Kong", "Emirates flight ticket London transit",
        "Flight ticket baggage add-on 20kg", "AirAsia seat selection hot seat meals",
        "Airport departure tax international", "Agoda hotel room booking 3 nights",
        "Booking.com resort staycation Penang", "Airbnb apartment booking Cameron Highlands",
        "Klook day tour theme park transfer", "Traveloka flight hotel package booking",
        # Vehicle Maintenance
        "Car wash snow wash and vacuum", "Auto detailing wax polish car",
        "Kedai tayar replace 2 Michelin tyres", "Wheel alignment and balancing workshop",
        "Tayar pancit repair patch puncture", "Engine oil service synthetic 5W-40",
        "Car regular service 10,000km maintenance", "Replace car battery Amaron dry cell",
        "Wiper blades replacement Bosch pair", "Towing truck service roadside breakdown",
        # Chinese Terms
        "加油站加RON95汽油", "壳牌加油站柴油", "Touch n Go一触即通充值", "RFID高速过路费",
        "轻快铁LRT车票", "地铁MRT单程代币", "电动火车KTM车票", "双轨火车ETS车票槟城",
        "机场快线KLIA Ekspres车票", "长途巴士车票吉隆坡槟城", "南北大道PLUS过路费",
        "商场地下停车场停车费", "手机市政局停车App缴费", "月租停车位办公室车位",
        "Grab打车去公司上班", "Grab机场送机服务", "德士出租车计价器打表",
        "亚航往返机票预订", "马航吉隆坡飞砂拉越机票", "Agoda预订酒店住宿两晚",
        "汽车洗车吸尘打蜡", "修车厂定期保养更换黑油机油", "补轮胎换米其林轮胎四条", "汽车更换电瓶蓄电池"
    ],

    "shopping": [
        # Fashion & Apparel
        "Uniqlo AIRism crew neck t-shirt", "Uniqlo ultra light down jacket",
        "Uniqlo ankle pants linen cotton", "Uniqlo UT graphic tee Disney",
        "Zara linen slim fit shirt", "Zara pleated trousers women",
        "Zara oversized blazer jacket", "H&M cotton basic t-shirt pack",
        "H&M skinny denim jeans pants", "Cotton On hoodie sweater",
        "Cotton On casual canvas shorts", "Padini Concept Store formal shirt",
        "Brands Outlet casual polo t-shirt", "Mango summer floral dress",
        "Pull&Bear streetwear graphic hoodie", "Bershka high waist denim skirt",
        "Levi's 501 original fit denim jeans", "Giordano basic polo shirt",
        # Shoes & Footwear
        "Nike Air Jordan 1 low sneakers", "Nike Air Force 1 triple white",
        "Nike Pegasus running shoes zoom", "Adidas Ultraboost 5 light running",
        "Adidas Samba classic leather shoes", "Puma suede classic sneakers",
        "New Balance 574 lifestyle shoes", "New Balance 990v5 running shoes",
        "Skechers slip-ins memory foam walking", "Asics Gel Kayano 30 running",
        "Vans old skool canvas skate shoes", "Converse Chuck Taylor All Star 70",
        "JD Sports sneaker shopping mall", "Foot Locker athletic sports shoes",
        "Charles & Keith ladies sling bag heels", "Pedro leather formal shoes belt",
        # E-Commerce & Online Orders
        "Shopee online shopping parcel checkout", "Shopee checkout PayLater payment",
        "Shopee voucher flash sale purchase", "Lazada parcel order tracking online",
        "Lazada LazMall guaranteed product order", "Taobao consolidated shipping fee direct",
        "Taobao cross-border air freight parcel", "TikTok Shop live stream buy clothes",
        "Amazon prime international delivery order", "Shein fast fashion women apparel",
        "AliExpress small packet direct shipping", "Carousell platform fee buy second hand",
        # Electronics & Gadgets
        "Apple Store iPhone 15 silicone case", "Apple Store USB-C 20W charger adapter",
        "Machines Apple authorised reseller AirPods", "Switch Apple lightning braided cable",
        "Samsung Experience Store Galaxy phone case", "Xiaomi Mi Store smart band watch",
        "Harvey Norman wireless bluetooth mouse", "All IT Hypermarket laptop stand cooling",
        "Thunder Match TMT mechanical keyboard switch", "Viewnet PC gaming mousepad large",
        "Anker powerbank 20000mAh fast charge", "Baseus braided USB cable 100W",
        "Logitech wireless keyboard silent combo", "SanDisk 128GB micro SD card extreme",
        # Beauty & Skincare
        "Sephora Fenty Beauty foundation matte", "Sephora perfume Eau de Parfum 50ml",
        "Watsons facial cleanser sunscreen SPF50", "Watsons moisturiser sheet masks box",
        "Guardian daily shampoo conditioner hair", "Bath & Body Works 3-wick scented candle",
        "The Body Shop tea tree face wash scrub", "Innisfree green tea seed serum",
        "Laneige water sleeping mask hydration", "Aesop aromatic hand balm resurrection",
        # Department Stores & Luxury
        "Parkson Department Store bedsheet comforter", "Sogo KL ladies handbag cosmetics",
        "Mid Valley Megamall weekend shopping spree", "Pavilion KL boutique luxury purchase",
        "Coach leather crossbody handbag sling", "Michael Kors tote bag jet set",
        "Swarovski crystal earrings necklace", "Ray-Ban classic aviator sunglasses polarized",
        "Decathlon hiking backpack 20L waterproof", "Decathlon yoga mat dumbbell fitness gear",
        # Chinese Terms
        "优衣库买短袖T恤裤子", "优衣库防风羽绒服外套", "Zara专柜买衬衫长裤", "H&M购买纯棉衣服",
        "耐克专卖店跑步鞋球鞋", "阿迪达斯三叶草运动板鞋", "New Balance休闲复古慢跑鞋",
        "小ck女包高跟鞋女鞋", "Pedro皮鞋男士皮带", "迪卡侬运动装备瑜伽垫水壶",
        "虾皮网购买衣服手机配件", "Lazada商城网购日用品包裹", "淘宝集运运费直邮到家",
        "抖音商城直播间下单女装", "亚马逊海淘正品直邮", "苹果专卖店买手机壳充电器",
        "小米之家智能手环充电宝", "罗技无线静音键盘鼠标套装", "丝芙兰买口红香水防晒霜",
        "屈臣氏买洗面奶护肤品面膜", "万宁买沐浴露洗发水洗护", "百盛百货商场买床上用品被单"
    ],

    "entertainment": [
        # Cinema & Movies
        "Golden Screen Cinemas GSC ticket IMAX", "GSC popcorn combo sweet caramel drink",
        "GSC movie ticket premiere 2D", "TGV Cinemas ticket IMAX Laser experience",
        "TGV popcorn royale combo drink", "TGV Cinemas indulge luxury reclining ticket",
        "MBO Cinemas movie ticket twin seat", "D-BOX motion seat movie ticket surcharge",
        "Cinema online ticket booking fee 2 tickets", "Movie screening advance ticket popcorn",
        # Gaming & Digital Games
        "Steam store summer sale PC game purchase", "Steam wallet top up funds reload",
        "PlayStation Store PS5 digital game deluxe", "PlayStation Plus 12 month membership",
        "Nintendo eShop switch digital game discount", "Nintendo Switch Online individual plan",
        "Xbox Game Pass PC ultimate subscription", "Riot Games Valorant points VP weapon skin",
        "Roblox Robux virtual game currency coins", "Genshin Impact blessing of welkin moon",
        "Honkai Star Rail express supply pass jade", "Mobile Legends 500 diamonds recharge",
        "Epic Games Store PC title purchase sale", "Razer Gold reload gaming voucher PIN",
        "Discord Nitro 1 month subscription boost", "Twitch channel tier 1 subscription gift",
        # Leisure Outings & Attractions
        "Sunway Lagoon theme park admission ticket", "Sunway Lagoon quack express fast pass",
        "Genting SkyWorlds outdoor theme park pass", "Genting Skytropolis indoor theme park",
        "Escape Theme Park Penang day adventure ticket", "Aquaria KLCC admission ticket adult",
        "Zoo Negara Malaysia day admission entry", "Petrosains discovery centre science ticket",
        "Illusion 3D Art Museum entrance ticket", "SuperPark Malaysia indoor activity park",
        "District 21 indoor action adventure IOI", "Ice skating rink Sunway Pyramid 2 hours",
        # Karaoke & Nightlife
        "Red Box Karaoke 3 hours singing room snack", "Neway Karaoke buffet dinner singing room",
        "Loud Speaker Karaoke student session 3 pax", "K-Box family karaoke microphone room",
        "Bowling alley 3 games shoes rental", "Snooker pool table 2 hours hourly rate",
        "Board game cafe 3 hours access coffee", "Escape room breakout puzzle ticket 4 pax",
        # Events & Concerts
        "Ticketmaster concert ticket category 1 seating", "Live Nation international artist concert pass",
        "BookMyShow music festival VIP entry ticket", "Stand-up comedy club night show ticket",
        "Art exhibition gallery ticket entrance", "KL Performing Arts Centre KLPAC play ticket",
        # Chinese Terms
        "GSC电影院看电影买票", "TGV电影院巨幕IMAX爆米花", "买电影票爆米花可乐套餐",
        "Steam夏日促销买单机游戏", "PlayStation游戏商城买PS5数字版", "Switch日服eshop折扣买游戏",
        "英雄联盟无畏契约充值皮肤", "原神小月卡充值创世结晶", "王者荣耀皮肤充值点券",
        "双威水上乐园门票门票成人", "云顶天城世界户外主题乐园", "国家动物园门票周末入场",
        "Red Box红盒唱K包厢下午茶", "大嘴叭Karaoke三人欢唱", "保龄球馆打两局租鞋子",
        "密室逃脱游戏团队门票", "桌游吧下午休闲玩桌游", "演唱会门票VIP看台座位", "艺术展门票门票脱口秀演出"
    ],

    "utilities": [
        # Electricity
        "Tenaga Nasional Berhad TNB electricity bill", "TNB bil elektrik rumah kediaman bulanan",
        "TNB bill payment JomPAY online banking", "TNB smart meter electricity usage charge",
        "Sabah Electricity SESB monthly bill payment", "Sarawak Energy SESCO domestic power bill",
        "Kedai Tenaga payment counter electricity", "TNB overdue reminder notice bill settlement",
        # Water
        "Pengurusan Air Selangor water bill payment", "Air Selangor bil bekalan air bulanan",
        "Syarikat Air Johor SAJ Ranhill water bill", "Perbadanan Bekalan Air Pulau Pinang PBA water",
        "Lembaga Air Perak LAP domestic water charges", "Syarikat Air Melaka SAMB water bill",
        "Syarikat Air Negeri Sembilan SAINS bill", "Bayar bil air paip kediaman online",
        # Sewerage & Sanitation
        "Indah Water Konsortium IWK sewerage bill", "IWK bil perkhidmatan pembetungan setengah tahun",
        "Alam Flora sisa pepejal disposal fee", "Majlis perbandaran sampah collection waste",
        # Gas
        "Gas Malaysia LPG piped gas monthly bill", "Gas tong cooking LPG cylinder delivery refill",
        "Mira gas cooking cylinder replacement 14kg", "Petronas cooking gas refill tong merah",
        # Assessment & Council Taxes
        "Cukai taksiran Dewan Bandaraya Kuala Lumpur DBKL", "Cukai pintu Majlis Bandaraya Petaling Jaya MBPJ",
        "Cukai taksiran Majlis Bandaraya Subang Jaya MBSJ", "Cukai pintu Majlis Perbandaran Klang MPK",
        "Pejabat Tanah dan Galian cukai tanah tahunan", "Cukai petak strata title parcel tax",
        # Chinese Terms
        "国家能源TNB每个月家用电费", "雪兰莪水供公司Air Selangor水费单", "柔佛州SAJ水费账单",
        "槟城供水机构PBA水费", "英达丽水IWK下水道排污费", "煤气公司管道煤气账单",
        "送煤气上门换一桶14公斤煤气", "吉隆坡市政局DBKL门牌税地税", "八打灵再也市政厅MBPJ门牌税",
        "地税局每年缴交土地税", "公寓分层地契单位税cukai petak", "缴清水电费单过期账单"
    ],

    "other": [
        # Laundry
        "Dobi Queen 24 hours self service laundry", "LaundryBar coin operated laundromat wash dry",
        "Cleanpro Express coin laundry mega wash 14kg", "Dobi layan diri cuci baju sabun free",
        "Dry cleaning 2-piece business suit wash", "Curtain dry clean pickup and delivery",
        "Kedai dobi cuci toto comforter selimut tebal", "Express laundry iron pressing service",
        "Laundromat dryer 25 minutes high heat", "Dobi lipat basuh baju kilo bulanan",
        # Courier & Postage
        "Pos Laju parcel postage tracking prepaid box", "J&T Express parcel shipping dropoff courier",
        "Ninja Van parcel delivery tracking fee", "DHL Express international courier document",
        "FedEx Express international shipping parcel", "GDEX courier service document delivery",
        "Lalamove on-demand motorcycle delivery document", "Lalamove 4x4 pickup delivery furniture",
        "GrabExpress instant parcel despatch rider", "Bungkusit personal runner delivery fee",
        "Pos Malaysia setem pos surat berdaftar",
        # Personal Grooming & Hair
        "Barbershop gent haircut styling pomade", "Kedai gunting rambut lelaki cuci potong",
        "Hair salon wash cut blow dry styling", "Hair dyeing coloring highlights treatment salon",
        "Nail salon gel manicure pedicure package", "Foot reflexology massage 60 minutes spa",
        "Thai traditional body massage 90 mins aromatherapy", "Facial treatment deep cleansing blackhead",
        # Printing & Stationery
        "Kedai printing photocopy photocopy binding", "Print color documents assignment A4 50 pages",
        "Stationery shop A4 paper notebook pens stapler", "Rubber stamp custom cop company official",
        "Laminate A4 certificate card pressing", "Plotter plan printing architectural drawing A1",
        # Repairs & Home Maintenance
        "Tukang paip repair water pipe leaking sink", "Electrician troubleshoot tripping short circuit",
        "Air conditioner service chemical wash master bedroom", "Inverter aircond gas topup R32 refill",
        "Locksmith open locked door replace padlock", "Duplicate key duplicate house access RFID card",
        "Pest control termite inspection spray treatment", "House deep cleaning moving in service 4 hours",
        "Shoe cobbler repair stitch soles leather shoes", "Watch battery replacement watchmaker service",
        # Chinese Terms
        "Dobi Queen自助投币洗衣烘干", "洗衣吧24小时投币洗衣店洗床单", "干洗店送洗衣物西装干洗",
        "寄快递Pos Laju快件邮寄费", "J&T快递寄包裹寄件费", "顺丰速运寄中国国际快递",
        "Lalamove啦啦快送送文件运费", "男士理发店剪头发洗头理发", "美发沙龙染发护理剪发",
        "美甲店做凝胶指甲光疗美甲", "泰式传统按摩足疗捏脚精油", "美容院面部深层清洁护理",
        "影印打印店复印A4纸装订论文", "文具店买笔和订书机胶带", "修水喉师傅上门修水管漏水",
        "冷气清洗师傅化学洗冷气加雪种", "开锁佬上门开锁换大门锁头", "配钥匙配公寓感应门禁卡"
    ],

    "rental": [
        # Residential Rent
        "Monthly master room rental inclusive wifi", "Small room monthly rent payment transfer",
        "Studio apartment monthly rental fee", "Condominium 3-bedroom monthly rental payment",
        "Landed double storey house monthly rental", "Sewa bilik sewa bulanan rumah bujang",
        "Bayar duit sewa rumah sebulan tuan rumah", "Rental payment transfer direct to landlord",
        # Deposits & Tenancy Fees
        "Rental security deposit 2 months advance", "Utilities deposit half month rental deposit",
        "Tenancy agreement stamping fee LHDN duty", "Agent professional commission fee rental",
        "Room key access card deposit refundable",
        # Commercial & Workspace
        "Shoplot ground floor monthly rental retail", "Office suite monthly lease payment corporate",
        "Co-working space hot desk monthly membership", "Virtual office registered business address fee",
        "Warehouse storage space monthly lease", "Kiosk booth monthly rental shopping mall",
        # Condo Management Fees
        "Condominium monthly maintenance fee service charge", "Apartment sinking fund contribution",
        "Management office monthly billing invoice", "Residential access tag card replacement fee",
        # Parking Space Rental
        "Season parking monthly fee basement car park", "Dedicated reserved car park lot rental",
        "Motorcycle season parking monthly pass",
        # Chinese Terms
        "转账支付每个月主人房租金", "转账单人间月租给屋主房东", "公寓整租每个月租金汇款",
        "排屋合租月租金转账", "租房两个月押金和半个月水电押金", "租约印花税LHDN盖印费",
        "中介租房佣金代理费", "商铺店面每个月店铺租金", "写字楼办公室每月租金月结",
        "联合办公空间工位月费会员", "公寓每月管理费maintenance fee", "公寓维修储备金sinking fund",
        "办公室大厦月租固定停车位", "公寓住户停车位出租月租"
    ],

    "phone-bill": [
        # Mobile Telco Postpaid
        "Maxis Postpaid 98 monthly billing invoice", "Maxis Postpaid 128 unlimited 5G data",
        "CelcomDigi Postpaid 5G 80 monthly bill", "Celcom Mega postpaid bill payment",
        "Digi Postpaid Infinite plan monthly fee", "U Mobile Postpaid 38 monthly bill payment",
        "U Mobile Postpaid 68 5G unlimited high speed", "Unifi Mobile Postpaid 39 monthly bill",
        "Yes 5G Infinite Postpaid basic monthly", "Hotlink Postpaid 60 high speed 5G",
        "Xpax Postpaid 60 unlimited social plan", "RedONE postpaid amazing 38 monthly bill",
        # Prepaid Topup & Reload
        "Maxis Hotlink prepaid RM30 internet reload", "Hotlink credit top up pin reload voucher",
        "Celcom Xpax prepaid reload RM50 validity", "Digi prepaid internet credit topup RM30",
        "U Mobile prepaid credit topup fast payment", "Yes 5G prepaid reload voucher RM30",
        "Tune Talk prepaid monthly data plan reload", "Yoodo custom plan renew data calls",
        # Home Fibre Broadband
        "TIME Internet Dotcom 500Mbps home fibre bill", "TIME Dotcom 1Gbps high speed broadband bill",
        "TM Unifi 100Mbps Home Fibre monthly billing", "TM Unifi 300Mbps high speed internet invoice",
        "Maxis Home Fibre 300Mbps bill payment", "CelcomDigi Home Fibre broadband monthly",
        "Astro Fibre 100Mbps bundle package bill", "Aloha WiFi portable broadband subscription",
        # Roaming & eSIM
        "Overseas roaming pass 7 days data passport", "Maxis Roam 1-Day pass data roaming",
        "International travel eSIM 10GB high speed", "Airalo travel eSIM data package Japan",
        # Chinese Terms
        "明讯Maxis每月手机后付费账单", "天地通数码CelcomDigi每月5G话费", "U Mobile手机月费后付费账单",
        "Hotlink预付费充值卡买话费30", "Digi电话卡充值买流量上网配套", "Yes 5G电话卡预付充值",
        "时代网TIME光纤宽带每月网络费", "马电讯TM Unifi家庭光纤宽带账单", "Maxis家庭宽带每月上网账单",
        "出国漫游流量包7天国际通行证", "购买日本旅游eSIM虚拟电话卡"
    ],

    "subscriptions": [
        # Video Streaming
        "Netflix Premium 4K ultra HD monthly plan", "Netflix standard monthly subscription",
        "YouTube Premium individual monthly membership", "YouTube Premium family plan 5 members",
        "Disney+ Hotstar 3-month premium stream", "Disney+ Hotstar annual mobile plan",
        "Amazon Prime Video monthly stream service", "HBO GO monthly subscription stream movies",
        "Apple TV+ monthly streaming subscription", "Viu Premium Korean drama monthly pass",
        "iQiyi VIP golden membership monthly renewal", "WeTV VIP monthly auto renew drama",
        # Audio & Music
        "Spotify Premium individual monthly auto renew", "Spotify Premium Family 6 accounts music",
        "Apple Music individual subscription plan", "YouTube Music monthly premium subscription",
        "Tidal HiFi lossless audio monthly subscription", "Audible audiobook 1 credit monthly plan",
        # Cloud Storage & Productivity
        "Apple iCloud+ 200GB monthly cloud storage", "Apple iCloud+ 50GB cloud backup storage",
        "Google One 2TB cloud storage backup", "Google One 100GB Google Drive monthly",
        "Microsoft 365 Personal annual subscription", "Microsoft OneDrive 100GB standalone storage",
        "Dropbox Plus 2TB annual cloud backup", "Evernote Personal monthly subscription",
        "Notion Plus personal plan annual billing",
        # AI & Developer Tools
        "OpenAI ChatGPT Plus monthly subscription", "Anthropic Claude Pro subscription monthly",
        "GitHub Copilot individual developer monthly", "Midjourney standard plan AI generation",
        "Adobe Creative Cloud photography plan 20GB", "Adobe Premiere Pro single app subscription",
        "Canva Pro annual creative design subscription", "Figma professional team seat subscription",
        # Gym & Fitness Memberships
        "Anytime Fitness monthly gym membership dues", "Celebrity Fitness monthly club access fee",
        "Fitness First platinum passport monthly fee", "Chi Fitness monthly gym access deduction",
        # News & Publications
        "The New York Times digital news access", "Bloomberg digital news monthly subscription",
        "Financial Times FT.com premium subscription", "Medium membership monthly support writers",
        # Chinese Terms
        "Netflix网飞高级4K会员月费", "YouTube油管家庭会员去广告月费", "Disney+迪士尼流媒体季卡会员",
        "Spotify声田音乐个人高级会员", "Apple Music苹果音乐月度订阅", "苹果iCloud 200G云空间月租",
        "谷歌Google One 2T网盘储存月费", "微软Office 365个人版按年订阅", "ChatGPT Plus官方月度会员续费",
        "Claude Pro人工智能订阅月费", "GitHub Copilot代码助手按月续费", "Adobe全家桶设计软件订阅",
        "Canva可画高级VIP会员年费", "Anytime Fitness健身房每月会员扣费", "健身房每月全通卡会员会费"
    ],

    "medical": [
        # GP & Clinics
        "Klinik Mediviron general practitioner consultation", "Klinik Kesihatan outpatient doctor fee",
        "Qualitas Health GP consultation fever flu", "Poliklinik consultation and cough medicine",
        "Doctor consultation fee and paracetamol", "Klinik 24 jam emergency doctor visit",
        # Dental Care
        "Dental clinic scaling and polishing teeth", "Klinik Pergigian composite tooth filling",
        "Dentist tooth extraction wisdom tooth surgery", "Orthodontist braces monthly adjustment tightening",
        "Dental root canal treatment front tooth", "Dental checkup and fluoride treatment child",
        # Pharmacy & Medications
        "Caring Pharmacy prescription medicine blood pressure", "BIG Pharmacy vitamins supplement omega 3",
        "Alpro Pharmacy diabetes test strips lancets", "Watsons pharmacy cough syrup Panadol box",
        "Guardian pharmacy rapid antigen test kit", "Panadol Actifast paracetamol tablets 20s",
        "Strepsils honey lemon sore throat lozenges", "Fluimucil effervescent tablets phlegm",
        "Gaviscon double action liquid antacid", "Eye drops Systane ultra lubricating tears",
        # Hospital & Specialist Care
        "Sunway Medical Centre specialist consultation", "Subang Jaya Medical Centre SJMC outpatient",
        "Pantai Hospital blood test profile screening", "Gleneagles Hospital specialist cardiologist fee",
        "Hospital Pantai radiology chest X-ray scan", "Pathlab comprehensive annual blood test",
        "BP Healthcare executive health screening package", "Physiotherapy sports injury rehabilitation session",
        # Optical & Vision
        "Focus Point prescription spectacles frame lenses", "Owndays blue light filter glasses eyewear",
        "MOG Eyewear disposable contact lenses monthly", "Acuvue Oasys daily contact lenses 30 pack",
        # Chinese Terms
        "普通诊所看病拿感冒发烧药", "家庭医生门诊看诊费和抗生素", "牙科诊所洗牙抛光去除牙结石",
        "牙医补牙树脂充填修补蛀牙", "牙医拔智齿微创拔牙手术", "牙齿正畸牙套每月复诊加力",
        "大专药剂买降血压药高血糖药", "康宁药房买深海鱼油维他命C", "屈臣氏药房买止咳糖浆必理痛",
        "买普拿疼退烧药润喉糖含片", "胃药胃酸倒流咀嚼片药水", "双威医疗中心专科医生看诊挂号",
        "班台私立医院验血做X光检查", "Pathlab全面身体健康体检配套", "物理治疗诊所肩颈劳损复健",
        "眼镜店配近视防蓝光眼镜镜片", "Owndays日式快速配镜框架眼镜", "购买博士伦强生隐形眼镜日抛"
    ],

    "insurance": [
        # Life & Medical Card
        "Prudential Assurance medical card policy premium", "Prudential PRUWith You investment linked plan",
        "AIA Takaful A-Life Ikhtiar medical policy", "AIA Public Takaful monthly contribution",
        "Great Eastern Life assurance policy premium", "Great Eastern Great MediShield contribution",
        "Allianz Life medical insurance plan monthly", "Manulife insurance retirement investment policy",
        "Zurich Life Takaful annual contribution payment", "Tokio Marine life protection plan premium",
        "Hong Leong Assurance HLA medical plan", "Sun Life Malaysia life takaful payment",
        # Motor & Car Insurance
        "Etiqa Takaful motor comprehensive insurance renewal", "Etiqa auto car insurance with road tax",
        "Kurnia motor insurance policy renewal 1.5L", "Takaful Malaysia general motor vehicle policy",
        "Allianz car insurance comprehensive coverage", "MSIG motor insurance windscreen coverage add-on",
        "Zurich motor takaful private vehicle renewal", "MyEG road tax renewal and courier fee",
        "JPJ road tax renewal 1 year sedan car",
        # Home & General Insurance
        "Houseowner fire insurance residential condo", "Zurich home content insurance coverage",
        "Personal accident insurance PA policy 24 hours", "Sompo travel insurance international 5 days",
        "Chubb travel insurance worldwide coverage flight",
        # Chinese Terms
        "保诚人寿Prudential医疗卡保费", "友邦保险AIA医疗保险每月保费", "大东方人寿Great Eastern人寿保险",
        "安联保险Allianz综合医疗险保费", "苏黎世保险Zurich人寿保单月缴", "富卫保险FWD定期寿险保单",
        "Etiqa汽车保险续保和更新路税", "Kurnia车险综合险包含挡风玻璃", "Allianz私家车全险保单转账",
        "更新一年汽车路税JPJ roadtax", "房屋火险住宅公寓火灾保险", "人身意外伤害保险PA单年交",
        "出国旅游保险5天境外旅行保障"
    ],

    "learning": [
        # School & University Fees
        "Kindergarten monthly school fees childcare", "Tadika preschool monthly tuition fees",
        "SJKC primary school PIBG contribution fund", "Secondary school semester exam fees books",
        "Private international school term fees payment", "College semester tuition fees diploma",
        "University degree tuition fee instalment", "University campus accommodation semester fee",
        "Master degree tuition fee instalment billing", "ACCA professional qualification exam registration",
        # Tuition & Academic Classes
        "Secondary SPM tuition center fees math science", "Primary UPSR tuition class BM English math",
        "Kumon math and reading monthly fees", "Tuition teacher home tutoring physics chemistry",
        "IGCSE exam preparation tuition fees bio", "Speech and drama academy monthly class fee",
        # Self-Learning & Online Platforms
        "Udemy full stack web development boot camp", "Coursera professional certificate subscription",
        "LinkedIn Learning monthly career skills pass", "Duolingo Super annual language learning pass",
        "Datacamp data science interactive subscription", "MasterClass annual all-access pass learning",
        # Books & Study Materials
        "Popular Bookstore revision workbooks stationery", "Kinokuniya technical programming reference books",
        "MPH Bookstores bestselling non-fiction book", "University textbook microeconomics hardcopy",
        # Skills & Extracurricular
        "Driving school driving license test package DA", "Driving academy B2 motorcycle license fee",
        "Yamaha music school piano lesson weekly class", "Acoustic guitar monthly tutoring lessons",
        "Swimming academy weekend swimming class child", "Art studio acrylic painting workshop 2 hours",
        # Chinese Terms
        "幼儿园每月保育学费杂费", "华小家教协会PIBG活动基金赞助", "私立独立中学学费每月缴交",
        "大学本科课程学期学费分期", "ACCA国际注册会计师考试报名费", "中小学数理科补习中心补习费",
        "Kumon公文式数学英语每月学费", "一对一家教老师上门补习物理", "Udemy购买Python数据分析课程",
        "Coursera在线专业证书月费会员", "Duolingo多邻国学英语高级会员", "大众书局买中小学作业参考书",
        "纪伊国屋书店买专业工具书", "驾校报名考汽车自动挡驾照", "雅马哈音乐学院钢琴初级课程", "少儿周末游泳兴趣班学费"
    ],

    "family": [
        # Baby & Toddler Care
        "MamyPoko Air Fit diaper pants extra large", "PetPet disposable baby diapers tape L pack",
        "Pampers baby dry tape newborn diapers", "Huggies ultra gold baby wipes 3 packs",
        "Similac baby milk formula step 3 1.8kg", "Enfamil A+ stage 2 infant formula powder",
        "Friso Gold step 4 growing up milk formula", "Pediasure complete nutrition vanilla powder",
        "Baby feeding bottle Philips Avent anti-colic", "Baby stroller lightweight compact folding pram",
        "Baby car seat ISOFIX newborn toddler group", "Mothercare cotton baby rompers pack of 3",
        "Cetaphil baby gentle wash and shampoo organic", "Sudocrem baby nappy diaper rash cream",
        # Pet Care & Supplies
        "Royal Canin adult cat dry food kibbles 4kg", "Royal Canin mini adult dog dry food 3kg",
        "Purina Pro Plan cat salmon wet food pouches", "Whiskas ocean fish canned cat food 12 cans",
        "Pedigree adult beef flavour dry dog kibbles", "Bentonite clump cat litter sand 10L bag",
        "Veterinary clinic annual core vaccine cat", "Vet consultation antibiotics ear mites treatment",
        "Pet grooming full package bath haircut dog", "Cat flea tick prevention spot-on Revolution",
        # Elderly Care & Parents Support
        "Monthly cash allowance transfer for beloved mother", "Duit belanja mak abah bulanan kampung",
        "Tena adult diapers discreet pants M size", "Ensure Gold vanilla nutrition milk powder elderly",
        "Health tonic Brand's bird's nest rock sugar box", "Blood pressure monitor Omron digital upper arm",
        # Home & Household Living
        "IKEA furniture bookshelf flat pack assembly", "IKEA cotton bedsheet quilt cover set queen",
        "Mr DIY household hardware repair tools nails", "Mr DIY cleaning mop broom floor cleaner",
        "Daiso household storage baskets plastic box", "Nitori blackout curtains bedroom 2 panels",
        "Philips steam iron non-stick household appliance", "Mistral table fan 16 inch living room",
        # Chinese Terms
        "买MamyPoko婴儿拉拉裤特大号", "帮宝适婴儿纸尿片特大包", "雅培小安素儿童营养奶粉",
        "美赞臣Enfamil二段配方奶粉", "飞利浦新安怡防胀气婴儿奶瓶", "Mothercare婴儿连体纯棉哈衣",
        "皇家幼猫全价干粮猫粮4公斤", "妙多乐三文鱼猫粮罐头整箱", "膨润土结团猫砂10公升无尘",
        "宠物医院猫咪打三联疫苗狂犬疫苗", "宠物美容店狗狗洗澡剪毛做造型", "每月给父母父母生活费家用",
        "添宁成年人纸尿裤拉拉裤", "雅培安素金装中老年营养奶粉", "白兰氏燕窝冰糖礼盒送长辈",
        "欧姆龙家用上臂式电子血压计", "宜家家居买书架组合衣柜抽屉", "MR DIY买五金工具螺丝刀扫把拖把",
        "大创Daiso买收纳盒塑料整理箱", "Nitori全遮光窗帘四件套"
    ],

    "salary": [
        # Monthly Payroll
        "Monthly salary direct crediting employer", "Basic salary crediting payroll transfer",
        "Net salary crediting Maybank corporate payroll", "Monthly executive salary payment receipt",
        "Staff salary deposit via bulk giro transfer", "Monthly remuneration direct bank payment",
        "Monthly payroll deposit Public Bank BERHAD", "Full time engineering salary payout month",
        # Overtime & Allowances
        "Overtime OT claim remuneration payout", "Weekend overtime work allowance credited",
        "Shift allowance and salary monthly package", "Night shift duty allowance credited salary",
        # Bonuses & Incentives
        "Annual performance bonus 2 months payout", "Company year-end bonus AWS 13th month",
        "Quarterly sales performance commission payout", "Sales target incentive commission remuneration",
        "Festive bonus Hari Raya Aidilfitri payout", "Chinese New Year festive appreciation bonus",
        "Director fees quarterly remuneration payout", "Board attendance allowance company payroll",
        # Malay Phrases
        "Gaji bulanan masuk Maybank akaun simpanan", "Bayaran gaji pokok kerja kilang majikan",
        "Elaun OT lebih masa masuk akaun bank", "Bonus tahunan prestasi kerja syarikat",
        "Gaji bersih bulanan kakitangan awam AG", "Duit gaji kerja part time cafe masuk",
        # Chinese Terms
        "公司每月薪水入账Maybank银行账户", "基本工资发放HR代发薪资", "每月固定薪水薪金转账到账",
        "加班费核算入账薪水总额", "季度销售业绩佣金提成发放", "公司年终奖双薪13薪入账",
        "年度绩效奖金分红打入工资卡", "兼职小时工工资结算转账", "董事津贴高管薪酬月度打款"
    ],

    "allowance": [
        # Student & Pocket Money
        "Monthly pocket money allowance from dad", "Duit poket bulanan mak ayah universiti",
        "Student monthly living allowance parents transfer", "Weekly school pocket money cash transfer",
        "Father transfer monthly living allowance study", "Mother weekly allowance remittance living",
        # Work & Company Allowances
        "Company monthly transport travel allowance", "Monthly meal food allowance company crediting",
        "Parking allowance reimbursement company payment", "Outstation travel per diem daily allowance",
        "Phone telco subsidy allowance reimbursement", "Internship monthly practical training stipend",
        "Intern practical trainee monthly allowance RM1000", "Apprentice trainee monthly living stipend",
        # Government Financial Aid
        "Sumbangan Tunai Rahmah STR fasa 1 payout", "Bantuan Tunai Rahmah kerajaan B40 crediting",
        "eMadani eWallet digital cash aid RM100", "Bantuan Awal Persekolahan BAP school aid",
        "Bantuan Prihatin Nasional BPN cash aid", "Government emergency flood relief grant BWI",
        # Chinese Terms
        "爸爸转过来的每个月生活费零花钱", "妈妈给的大学每周生活津贴零用钱", "父母汇款给的留学生伙食生活津贴",
        "公司发放的每月交通差旅津贴", "公司每月出差餐饮饭补津贴", "实习生每月带薪实习津贴stipend",
        "政府爱心援助金STR第一阶段到账", "政府eMadani电子钱包援助金100", "中小学开学初援助金BAP补助",
        "政府水灾水患紧急生活救济金"
    ],

    "other-income": [
        # Stock & Investment Dividends
        "Maybank share quarterly dividend payout crediting", "Public Bank cash dividend payment credited",
        "Tenaga Nasional Berhad share dividend payment", "CIMB Group Holdings dividend cash distribution",
        "Bursa Malaysia listed shares dividend direct", "Amanah Saham Bumiputera ASB annual dividend",
        "Amanah Saham Nasional ASN unit trust dividend", "EPF KWSP annual dividend income credited",
        "Private equity fund distribution dividend payout", "Real estate investment trust REIT distribution",
        # Interest & Cashback
        "Bank fixed deposit FD monthly interest earnings", "High interest savings account interest payment",
        "StashAway simple cash management return earned", "Versa cash management interest return earned",
        "KDI Save daily interest profit crediting", "Credit card monthly cashback reward credit",
        "GrabPay eWallet cashback points rebate rebate", "ShopeePay instant coins cashback rebate rebate",
        "TnG eWallet cashback merchant campaign voucher",
        # Freelance & Side Hustle
        "Freelance website development project final milestone", "Graphic design logo branding freelance payout",
        "Copywriting articles content marketing payment", "Photography gig event wedding photography fee",
        "Private home tuition tutoring freelance payment", "Grab driver earnings weekly cash out transfer",
        "Food delivery rider weekly earnings payout", "Shopee affiliate commission monthly remittance",
        "TikTok creator reward program payout funds", "YouTube AdSense advertising revenue payout",
        # Second Hand Sales & Refunds
        "Carousell buyer transfer sold iPhone 13", "Carousell buyer payment sold second hand chair",
        "Facebook Marketplace sold preloved baby cot cash", "Shopee refund approved returned defective item",
        "Lazada return and refund credited to wallet", "AirAsia flight cancellation full ticket refund",
        "Rental security deposit balance refunded landlord",
        # Chinese Terms
        "马来亚银行股票季度现金分红派息", "大众银行年度股票股息到账", "公积金EPF每年利息分红入账",
        "国民投资ASB土著信托基金分红", "银行定期存款FD每月利息结息", "理财平台Versa现金管理每日收益",
        "信用卡月度消费现金返现Cashback", "虾皮返还现金硬币兑现", "自由职业外包网页设计尾款到账",
        "接单平面设计Logo项目报酬转账", "婚礼跟拍摄影活动劳务费收入", "YouTube谷歌广告AdSense收益到账",
        "Carousell旋转拍卖二手转卖手机收入", "退货退款虾皮退款入账钱包", "亚航取消航班机票款全额退还",
        "退租房东全额退还押金余款"
    ]
}

STANDALONE_AND_TYPOS = [
    # Food
    ("lunch", "food"), ("dinner", "food"), ("breakfast", "food"), ("brunch", "food"),
    ("coffee", "food"), ("groceries", "food"), ("meal", "food"), ("snack", "food"),
    ("luch", "food"), ("lunsh", "food"), ("lnch", "food"), ("lnuch", "food"),
    ("diner", "food"), ("dinnr", "food"), ("dnner", "food"),
    ("brekfast", "food"), ("breakfst", "food"), ("brkfast", "food"),
    ("coffe", "food"), ("cofe", "food"), ("cofffe", "food"),
    ("groceris", "food"), ("groceries", "food"), ("groc", "food"),
    ("strbucks", "food"), ("starbcks", "food"), ("mcdonald", "food"), ("mcdonalds", "food"),
    ("laksa", "food"), ("boba", "food"), ("tealive", "food"), ("zus coffee", "food"),
    ("午餐", "food"), ("晚餐", "food"), ("早餐", "food"), ("咖啡", "food"), ("奶茶", "food"),

    # Travelling
    ("grab", "travelling"), ("taxi", "travelling"), ("petrol", "travelling"), ("parking", "travelling"),
    ("toll", "travelling"), ("flight", "travelling"), ("bus", "travelling"), ("train", "travelling"),
    ("mrt", "travelling"), ("lrt", "travelling"), ("fuel", "travelling"),
    ("petro", "travelling"), ("petrl", "travelling"), ("ptrol", "travelling"),
    ("parkng", "travelling"), ("parkin", "travelling"), ("flght", "travelling"), ("fligt", "travelling"),
    ("grabride", "travelling"), ("airasia", "travelling"), ("touch n go", "travelling"),
    ("打车", "travelling"), ("地铁", "travelling"), ("油费", "travelling"), ("停车", "travelling"),

    # Entertainment
    ("movie", "entertainment"), ("cinema", "entertainment"), ("concert", "entertainment"),
    ("game", "entertainment"), ("karaoke", "entertainment"), ("steam", "entertainment"),
    ("movi", "entertainment"), ("mvoie", "entertainment"), ("cinma", "entertainment"),
    ("电影", "entertainment"), ("游戏", "entertainment"), ("看电影", "entertainment"),

    # Shopping
    ("shopping", "shopping"), ("clothes", "shopping"), ("clothing", "shopping"), ("shoes", "shopping"),
    ("shoppin", "shopping"), ("cloths", "shopping"), ("uniqlo", "shopping"), ("zara", "shopping"),
    ("shopee", "shopping"), ("lazada", "shopping"), ("taobao", "shopping"),
    ("购物", "shopping"), ("买衣服", "shopping"),

    # Rental
    ("rent", "rental"), ("rental", "rental"), ("mortgage", "rental"), ("house rent", "rental"),
    ("room rent", "rental"), ("rntal", "rental"),
    ("房租", "rental"), ("租金", "rental"),

    # Phone bill
    ("phone bill", "phone-bill"), ("wifi", "phone-bill"), ("broadband", "phone-bill"), ("mobile plan", "phone-bill"),
    ("telco", "phone-bill"), ("internet bill", "phone-bill"), ("maxis", "phone-bill"), ("celcom", "phone-bill"),
    ("digi", "phone-bill"), ("unifi", "phone-bill"),
    ("话费", "phone-bill"), ("电话费", "phone-bill"), ("宽带", "phone-bill"),

    # Insurance
    ("insurance", "insurance"), ("premium", "insurance"), ("prudential", "insurance"), ("aia", "insurance"),
    ("great eastern", "insurance"), ("allianz", "insurance"), ("etiqa", "insurance"), ("insuranc", "insurance"),
    ("保险", "insurance"), ("保费", "insurance"),

    # Subscriptions
    ("subscription", "subscriptions"), ("netflix", "subscriptions"), ("spotify", "subscriptions"),
    ("youtube premium", "subscriptions"), ("icloud", "subscriptions"), ("subscrption", "subscriptions"),
    ("subcription", "subscriptions"), ("chatgpt", "subscriptions"),
    ("订阅", "subscriptions"), ("会员", "subscriptions"),

    # Family
    ("family", "family"), ("baby", "family"), ("diapers", "family"), ("milk powder", "family"),
    ("childcare", "family"), ("pet food", "family"), ("cat food", "family"), ("dog food", "family"),
    ("diaper", "family"), ("pampers", "family"),
    ("家庭", "family"), ("奶粉", "family"), ("纸尿裤", "family"),

    # Medical
    ("doctor", "medical"), ("clinic", "medical"), ("medicine", "medical"), ("pharmacy", "medical"),
    ("dentist", "medical"), ("hospital", "medical"),
    ("docotr", "medical"), ("docter", "medical"), ("clnic", "medical"), ("medicin", "medical"),
    ("看病", "medical"), ("医生", "medical"), ("诊所", "medical"), ("药房", "medical"),

    # Learning
    ("tuition", "learning"), ("school", "learning"), ("course", "learning"), ("textbook", "learning"),
    ("education", "learning"), ("exam fee", "learning"),
    ("tution", "learning"), ("scholl", "learning"), ("corse", "learning"),
    ("学费", "learning"), ("补习", "learning"), ("课程", "learning"),

    # Utilities
    ("electricity", "utilities"), ("electric", "utilities"), ("water bill", "utilities"), ("gas bill", "utilities"),
    ("utilities", "utilities"), ("tnb", "utilities"), ("electrc", "utilities"), ("utiliti", "utilities"),
    ("水费", "utilities"), ("电费", "utilities"), ("水电", "utilities"),

    # Other
    ("laundry", "other"), ("dobi", "other"), ("dry clean", "other"), ("haircut", "other"),
    ("barber", "other"), ("courier", "other"), ("postage", "other"), ("printing", "other"),
    ("lauundry", "other"), ("dobi queen", "other"),
    ("洗衣", "other"), ("理发", "other"), ("快递", "other"),

    # Salary
    ("salary", "salary"), ("payroll", "salary"), ("wage", "salary"), ("monthly salary", "salary"),
    ("salry", "salary"), ("salari", "salary"), ("bonus", "salary"),
    ("薪水", "salary"), ("工资", "salary"),

    # Allowance
    ("allowance", "allowance"), ("pocket money", "allowance"), ("living allowance", "allowance"),
    ("stipend", "allowance"), ("allowenc", "allowance"), ("alowance", "allowance"),
    ("零花钱", "allowance"), ("生活费", "allowance"), ("津贴", "allowance"),

    # Other income
    ("dividend", "other-income"), ("cashback", "other-income"), ("interest", "other-income"),
    ("freelance", "other-income"), ("refund", "other-income"), ("divdend", "other-income"),
    ("分红", "other-income"), ("利息", "other-income"), ("退款", "other-income")
]

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    existing_file = os.path.join(script_dir, "dataset.json")
    
    existing_samples = []
    if os.path.exists(existing_file):
        with open(existing_file, "r", encoding="utf-8") as f:
            existing_samples = json.load(f)
    
    seen = set()
    combined = []
    
    # Keep existing high quality samples
    for s in existing_samples:
        key = (s["text"].strip().lower(), s["category"])
        if key not in seen:
            seen.add(key)
            combined.append({"text": s["text"].strip(), "category": s["category"]})
            
    # Add newly curated categories
    for cat, items in DATA_RAW.items():
        for item in items:
            key = (item.strip().lower(), cat)
            if key not in seen:
                seen.add(key)
                combined.append({"text": item.strip(), "category": cat})

    # Add standalone keywords and common typos
    for text, cat in STANDALONE_AND_TYPOS:
        key = (text.strip().lower(), cat)
        if key not in seen:
            seen.add(key)
            combined.append({"text": text.strip(), "category": cat})

    # Add common prefixes and colloquial templates
    augmented = []
    for s in combined:
        augmented.append(s)
        text = s["text"]
        cat = s["category"]
        words = text.split()
        # Brand name by itself if multi-word
        if len(words) >= 3 and words[0].isalpha() and len(words[0]) > 3:
            short_brand = f"{words[0]} {words[1]}"
            key = (short_brand.lower(), cat)
            if key not in seen:
                seen.add(key)
                augmented.append({"text": short_brand, "category": cat})

    random.seed(42)
    random.shuffle(augmented)

    out_file = os.path.join(script_dir, "dataset.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(augmented, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(augmented)} samples in {out_file}")
    from collections import Counter
    counts = Counter(s["category"] for s in augmented)
    for c in sorted(counts.keys()):
        print(f"  {c:<16}: {counts[c]}")

if __name__ == "__main__":
    main()
