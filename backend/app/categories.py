"""
Expense categories — single source of truth.
"""

CATEGORIES = {
    "Food": ["Restaurant", "Groceries", "Fast Food", "Snacks", "Coffee", "Other"],
    "Transport": ["Bus", "Train", "Metro", "Auto Rickshaw", "Taxi", "Fuel", "Parking", "Other"],
    "Shopping": ["Clothing", "Footwear", "Electronics", "Books", "Other"],
    "Bills": ["Electricity", "Water", "Internet", "Mobile", "Rent", "Gas", "Other"],
    "Entertainment": ["Movies", "Games", "Events", "Streaming", "Other"],
    "Health": ["Medicine", "Doctor", "Gym", "Other"],
    "Education": ["Tuition", "Books", "Courses", "Stationery", "Other"],
    "Travel": ["Flight", "Hotel", "Food", "Sightseeing", "Other"],
    "Subscriptions": ["Apps", "Music", "Cloud", "Other"],
    "Personal Care": ["Salon", "Cosmetics", "Other"],
    "Home": ["Furniture", "Appliances", "Maintenance", "Other"],
    "Other": ["Other"],
}

CATEGORY_LIST = list(CATEGORIES.keys())

PAYMENT_METHODS = [
    "Cash",
    "UPI",
    "Credit Card",
    "Debit Card",
    "Bank Transfer",
    "Other",
    "Unknown",
]

EXPENSE_SOURCES = ["manual", "natural_language", "receipt"]
