import pandas as pd

df = pd.read_csv('data_raw.csv', encoding='utf-8-sig')

# Check before
print("Before:")
print(df['label'].value_counts())

# Merge both into SeriesFR
df['label'] = df['label'].replace({
    'SeriesCN':           'SeriesFR',
    'SeriesKR,TL,IND,PHI': 'SeriesFR'
})

# Check after
print("\nAfter:")
print(df['label'].value_counts())

# Save
df.to_csv('data_raw.csv', index=False, encoding='utf-8-sig')
print("\nDone — saved to data_raw.csv")