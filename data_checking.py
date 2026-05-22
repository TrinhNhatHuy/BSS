import pandas as pd

df = pd.read_csv('training_final.csv', encoding='utf-8-sig')

print("=== Distribution ===")
print(df['label'].value_counts())

print("\n=== Valid labels only ===")
VALID = {'SeriesVN','SeriesFR','Kids','Music','Sports','News','Others'}
invalid = df[~df['label'].isin(VALID)]
print(f"Invalid label rows: {len(invalid)}")

print("\n=== Text length stats ===")
df['text_len'] = df['text'].str.len()
print(df['text_len'].describe())

print("\n=== Sample rows ===")
for label in df['label'].unique():
    sample = df[df['label'] == label].iloc[0]
    print(f"\n[{label}] {sample['text'][:80]}")