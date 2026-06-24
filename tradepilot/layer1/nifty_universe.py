"""Nifty Universe — seed list of symbols with sector tags.

~75 Nifty200 + ~20 Nifty500-extra symbols.
Placeholder until a live NSE constituent pull replaces it before real money.

NOTE: This list was manually assembled from NSE's Nifty 200 and Nifty 500 indices.
Sectors are approximate. Before the 50-trade validation run completes, this should
be replaced with an automated pull from NSE's index constituents API.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class StockInfo:
    symbol: str
    name: str
    sector: str
    index: str  # "Nifty200" or "Nifty500"


# Core Nifty200 (~75 most liquid names)
NIFTY200_STOCKS = [
    StockInfo("RELIANCE", "Reliance Industries", "Oil & Gas", "Nifty200"),
    StockInfo("TCS", "Tata Consultancy", "IT", "Nifty200"),
    StockInfo("HDFCBANK", "HDFC Bank", "Banking", "Nifty200"),
    StockInfo("INFY", "Infosys", "IT", "Nifty200"),
    StockInfo("ICICIBANK", "ICICI Bank", "Banking", "Nifty200"),
    StockInfo("HINDUNILVR", "Hindustan Unilever", "FMCG", "Nifty200"),
    StockInfo("ITC", "ITC Limited", "FMCG", "Nifty200"),
    StockInfo("SBIN", "State Bank of India", "Banking", "Nifty200"),
    StockInfo("BHARTIARTL", "Bharti Airtel", "Telecom", "Nifty200"),
    StockInfo("KOTAKBANK", "Kotak Mahindra Bank", "Banking", "Nifty200"),
    StockInfo("LT", "Larsen & Toubro", "Infrastructure", "Nifty200"),
    StockInfo("AXISBANK", "Axis Bank", "Banking", "Nifty200"),
    StockInfo("ASIANPAINT", "Asian Paints", "Consumer", "Nifty200"),
    StockInfo("MARUTI", "Maruti Suzuki", "Auto", "Nifty200"),
    StockInfo("TITAN", "Titan Company", "Consumer", "Nifty200"),
    StockInfo("SUNPHARMA", "Sun Pharmaceutical", "Pharma", "Nifty200"),
    StockInfo("BAJFINANCE", "Bajaj Finance", "Finance", "Nifty200"),
    StockInfo("WIPRO", "Wipro", "IT", "Nifty200"),
    StockInfo("HCLTECH", "HCL Technologies", "IT", "Nifty200"),
    StockInfo("ULTRACEMCO", "UltraTech Cement", "Cement", "Nifty200"),
    StockInfo("NTPC", "NTPC Limited", "Power", "Nifty200"),
    StockInfo("POWERGRID", "Power Grid Corp", "Power", "Nifty200"),
    StockInfo("ONGC", "ONGC", "Oil & Gas", "Nifty200"),
    StockInfo("TATAMOTORS", "Tata Motors", "Auto", "Nifty200"),
    StockInfo("COALINDIA", "Coal India", "Mining", "Nifty200"),
    StockInfo("BAJAJFINSV", "Bajaj Finserv", "Finance", "Nifty200"),
    StockInfo("TECHM", "Tech Mahindra", "IT", "Nifty200"),
    StockInfo("NESTLEIND", "Nestle India", "FMCG", "Nifty200"),
    StockInfo("TATASTEEL", "Tata Steel", "Metals", "Nifty200"),
    StockInfo("JSWSTEEL", "JSW Steel", "Metals", "Nifty200"),
    StockInfo("HINDALCO", "Hindalco", "Metals", "Nifty200"),
    StockInfo("INDUSINDBK", "IndusInd Bank", "Banking", "Nifty200"),
    StockInfo("CIPLA", "Cipla", "Pharma", "Nifty200"),
    StockInfo("DRREDDY", "Dr Reddy's Labs", "Pharma", "Nifty200"),
    StockInfo("APOLLOHOSP", "Apollo Hospitals", "Healthcare", "Nifty200"),
    StockInfo("EICHERMOT", "Eicher Motors", "Auto", "Nifty200"),
    StockInfo("DIVISLAB", "Divi's Labs", "Pharma", "Nifty200"),
    StockInfo("BPCL", "BPCL", "Oil & Gas", "Nifty200"),
    StockInfo("GRASIM", "Grasim Industries", "Cement", "Nifty200"),
    StockInfo("TATACONSUM", "Tata Consumer", "FMCG", "Nifty200"),
    StockInfo("BRITANNIA", "Britannia", "FMCG", "Nifty200"),
    StockInfo("HEROMOTOCO", "Hero MotoCorp", "Auto", "Nifty200"),
    StockInfo("SBILIFE", "SBI Life Insurance", "Insurance", "Nifty200"),
    StockInfo("HDFCLIFE", "HDFC Life", "Insurance", "Nifty200"),
    StockInfo("DABUR", "Dabur India", "FMCG", "Nifty200"),
    StockInfo("PIDILITIND", "Pidilite Industries", "Chemicals", "Nifty200"),
    StockInfo("GODREJCP", "Godrej Consumer", "FMCG", "Nifty200"),
    StockInfo("BANKBARODA", "Bank of Baroda", "Banking", "Nifty200"),
    StockInfo("PNB", "Punjab National Bank", "Banking", "Nifty200"),
    StockInfo("IOC", "Indian Oil Corp", "Oil & Gas", "Nifty200"),
    StockInfo("GAIL", "GAIL India", "Oil & Gas", "Nifty200"),
    StockInfo("VEDL", "Vedanta", "Metals", "Nifty200"),
    StockInfo("TRENT", "Trent Limited", "Retail", "Nifty200"),
    StockInfo("ZOMATO", "Zomato", "Tech", "Nifty200"),
    StockInfo("IRCTC", "IRCTC", "Travel", "Nifty200"),
    StockInfo("HAL", "Hindustan Aeronautics", "Defence", "Nifty200"),
    StockInfo("BEL", "Bharat Electronics", "Defence", "Nifty200"),
    StockInfo("RECLTD", "REC Limited", "Finance", "Nifty200"),
    StockInfo("PFC", "Power Finance Corp", "Finance", "Nifty200"),
    StockInfo("NHPC", "NHPC", "Power", "Nifty200"),
    StockInfo("TATAPOWER", "Tata Power", "Power", "Nifty200"),
    StockInfo("ADANIPORTS", "Adani Ports", "Infrastructure", "Nifty200"),
    StockInfo("M&M", "Mahindra & Mahindra", "Auto", "Nifty200"),
    StockInfo("BAJAJ-AUTO", "Bajaj Auto", "Auto", "Nifty200"),
    StockInfo("DMART", "Avenue Supermarts", "Retail", "Nifty200"),
    StockInfo("PERSISTENT", "Persistent Systems", "IT", "Nifty200"),
    StockInfo("COFORGE", "Coforge", "IT", "Nifty200"),
    StockInfo("LTIM", "LTIMindtree", "IT", "Nifty200"),
    StockInfo("MPHASIS", "Mphasis", "IT", "Nifty200"),
    StockInfo("MAXHEALTH", "Max Healthcare", "Healthcare", "Nifty200"),
    StockInfo("FORTIS", "Fortis Healthcare", "Healthcare", "Nifty200"),
    StockInfo("CHOLAFIN", "Cholamandalam Fin", "Finance", "Nifty200"),
    StockInfo("MUTHOOTFIN", "Muthoot Finance", "Finance", "Nifty200"),
    StockInfo("VOLTAS", "Voltas", "Consumer", "Nifty200"),
    StockInfo("SIEMENS", "Siemens India", "Infrastructure", "Nifty200"),
]

# Nifty500-extra (beyond Nifty200, for Tier D universe expansion)
NIFTY500_EXTRA = [
    StockInfo("POLYCAB", "Polycab India", "Infrastructure", "Nifty500"),
    StockInfo("TATAELXSI", "Tata Elxsi", "IT", "Nifty500"),
    StockInfo("Dixon", "Dixon Technologies", "Electronics", "Nifty500"),
    StockInfo("DEEPAKNTR", "Deepak Nitrite", "Chemicals", "Nifty500"),
    StockInfo("ASTRAL", "Astral", "Infrastructure", "Nifty500"),
    StockInfo("AFFLE", "Affle India", "Tech", "Nifty500"),
    StockInfo("ROUTE", "Route Mobile", "Tech", "Nifty500"),
    StockInfo("KPITTECH", "KPIT Technologies", "IT", "Nifty500"),
    StockInfo("ANGELONE", "Angel One", "Finance", "Nifty500"),
    StockInfo("HAPPSTMNDS", "Happiest Minds", "IT", "Nifty500"),
    StockInfo("KAYNES", "Kaynes Technology", "Electronics", "Nifty500"),
    StockInfo("JYOTHYLAB", "Jyothy Labs", "FMCG", "Nifty500"),
    StockInfo("RADICO", "Radico Khaitan", "FMCG", "Nifty500"),
    StockInfo("GRINDWELL", "Grindwell Norton", "Manufacturing", "Nifty500"),
    StockInfo("FINEORG", "Fine Organic", "Chemicals", "Nifty500"),
    StockInfo("CLEAN", "Clean Science", "Chemicals", "Nifty500"),
    StockInfo("RATNAMANI", "Ratnamani Metals", "Metals", "Nifty500"),
    StockInfo("CAMS", "CAMS", "Finance", "Nifty500"),
    StockInfo("CDSL", "CDSL", "Finance", "Nifty500"),
    StockInfo("SONACOMS", "Sona BLW", "Auto", "Nifty500"),
]


def get_universe(include_nifty500: bool = False) -> list[StockInfo]:
    """Get the full universe list based on tier."""
    if include_nifty500:
        return NIFTY200_STOCKS + NIFTY500_EXTRA
    return NIFTY200_STOCKS


def get_symbol_list(include_nifty500: bool = False) -> list[str]:
    """Get just the symbol strings."""
    return [s.symbol for s in get_universe(include_nifty500)]


def get_sector_map(include_nifty500: bool = False) -> dict[str, str]:
    """Get symbol→sector mapping."""
    return {s.symbol: s.sector for s in get_universe(include_nifty500)}
