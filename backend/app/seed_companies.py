from .models.company import Company

COMPANIES_DATA = [
    {
        "name": "MP Materials", "name_zh": "MP材料",
        "ticker": "MP", "exchange": "NYSE", "country": "United States",
        "minerals_focus": ["Neodymium", "Praseodymium", "Rare Earth"],
        "description": "Largest rare earth mining and processing company in the Western Hemisphere. Operates Mountain Pass mine in California.",
        "description_zh": "西半球最大稀土采矿和加工公司，运营加州Mountain Pass矿。",
        "website": "https://mpmaterials.com",
    },
    {
        "name": "Lynas Rare Earths", "name_zh": "莱纳斯稀土",
        "ticker": "LYC.AX", "exchange": "ASX", "country": "Australia",
        "minerals_focus": ["Neodymium", "Praseodymium", "Dysprosium", "Rare Earth"],
        "description": "World's largest rare earth producer outside China. Mines in Western Australia, processes in Malaysia.",
        "description_zh": "中国以外全球最大稀土生产商，在西澳开采、马来西亚加工。",
        "website": "https://lynasrareearths.com",
    },
    {
        "name": "Albemarle", "name_zh": "雅保",
        "ticker": "ALB", "exchange": "NYSE", "country": "United States",
        "minerals_focus": ["Lithium"],
        "description": "World's largest lithium producer. Supplies lithium compounds to EV battery manufacturers globally.",
        "description_zh": "全球最大锂生产商，向全球电动汽车电池制造商供应锂化合物。",
        "website": "https://albemarle.com",
    },
    {
        "name": "SQM", "name_zh": "智利化工矿业",
        "ticker": "SQM", "exchange": "NYSE", "country": "Chile",
        "minerals_focus": ["Lithium", "Copper"],
        "description": "Chilean lithium and specialty chemicals company. Operates in the Atacama Desert lithium brine.",
        "description_zh": "智利锂及特种化学品公司，在阿塔卡马沙漠盐湖提锂。",
        "website": "https://sqm.com",
    },
    {
        "name": "Ganfeng Lithium", "name_zh": "赣锋锂业",
        "ticker": "GNENF", "exchange": "OTC", "country": "China",
        "minerals_focus": ["Lithium", "Cobalt"],
        "description": "China's largest lithium compounds manufacturer. Controls lithium assets in Argentina, Australia, and Ireland.",
        "description_zh": "中国最大锂化合物制造商，在阿根廷、澳大利亚和爱尔兰控制锂资产。",
        "website": "https://ganfenglithium.com",
    },
    {
        "name": "BHP Group", "name_zh": "必和必拓",
        "ticker": "BHP", "exchange": "NYSE", "country": "Australia",
        "minerals_focus": ["Copper", "Nickel", "Cobalt"],
        "description": "World's largest mining company. Key supplier of copper, nickel, and cobalt for EV supply chains.",
        "description_zh": "全球最大矿业公司。铜、镍、钴的主要供应商，深度参与电动汽车供应链。",
        "website": "https://bhp.com",
    },
    {
        "name": "Rio Tinto", "name_zh": "力拓",
        "ticker": "RIO", "exchange": "NYSE", "country": "United Kingdom",
        "minerals_focus": ["Aluminum", "Copper", "Lithium"],
        "description": "Global mining giant with major copper and aluminum operations; expanding into lithium via Jadar project.",
        "description_zh": "全球矿业巨头，铜铝业务领先，通过Jadar项目布局锂资源。",
        "website": "https://riotinto.com",
    },
    {
        "name": "Glencore", "name_zh": "嘉能可",
        "ticker": "GLNCY", "exchange": "OTC", "country": "Switzerland",
        "minerals_focus": ["Cobalt", "Copper", "Nickel"],
        "description": "World's largest cobalt producer and major copper/nickel trader. Controls DRC cobalt supply chain.",
        "description_zh": "全球最大钴生产商和主要铜镍贸易商，掌控刚果(金)钴供应链。",
        "website": "https://glencore.com",
    },
    {
        "name": "Freeport-McMoRan", "name_zh": "自由港麦克莫兰",
        "ticker": "FCX", "exchange": "NYSE", "country": "United States",
        "minerals_focus": ["Copper", "Molybdenum", "Gold"],
        "description": "World's largest publicly traded copper producer. Operates Grasberg mine in Indonesia.",
        "description_zh": "全球最大上市铜生产商，运营印尼格拉斯伯格矿（世界最大铜金矿之一）。",
        "website": "https://fcx.com",
    },
    {
        "name": "Vale", "name_zh": "淡水河谷",
        "ticker": "VALE", "exchange": "NYSE", "country": "Brazil",
        "minerals_focus": ["Nickel", "Copper", "Cobalt"],
        "description": "World's largest nickel producer and major iron ore supplier. Key battery metals supplier.",
        "description_zh": "全球最大镍生产商和主要铁矿石供应商，电池金属关键供应方。",
        "website": "https://vale.com",
    },
    {
        "name": "Umicore", "name_zh": "优美科",
        "ticker": "UMICF", "exchange": "OTC", "country": "Belgium",
        "minerals_focus": ["Cobalt", "Platinum", "Palladium"],
        "description": "Global materials technology leader specialising in cobalt recycling and PGM processing for catalytic converters.",
        "description_zh": "全球材料技术领导者，专注钴回收和铂族金属催化转化器加工。",
        "website": "https://umicore.com",
    },
    {
        "name": "Norilsk Nickel", "name_zh": "诺里尔斯克镍业",
        "ticker": "NILSY", "exchange": "OTC", "country": "Russia",
        "minerals_focus": ["Nickel", "Palladium", "Copper", "Cobalt"],
        "description": "World's largest producer of palladium and high-grade nickel. Supplies ~40% of global palladium.",
        "description_zh": "全球最大钯和高品位镍生产商，提供全球约40%钯供应量。",
        "website": "https://nornickel.com",
    },
]


async def seed_companies(db) -> None:
    from sqlalchemy import select
    for data in COMPANIES_DATA:
        result = await db.execute(select(Company).where(Company.name == data["name"]))
        if not result.scalar_one_or_none():
            db.add(Company(**data))
