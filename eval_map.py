import argparse, pickle, numpy as np, csv


def load_pickle(path):
    with open(path, "rb") as f:
        return pickle.load(f)


def labels_from_paths(paths):
    return np.array([p.split("/", 1)[0] if "/" in p else p for p in paths])


def average_precision_at_k(sorted_labels, query_label, k):
    k = min(k, len(sorted_labels))
    hits, precisions = 0, []
    for i in range(k):
        if sorted_labels[i] == query_label:
            hits += 1
            precisions.append(hits / (i + 1))
    return float(np.mean(precisions)) if hits > 0 else 0.0


def map_at_ks(vectors, labels, ks=(1, 5, 10, 20)):
    sim = vectors @ vectors.T
    np.fill_diagonal(sim, -np.inf)
    rank_idx = np.argsort(sim, axis=1)[:, ::-1]
    aps = {k: [] for k in ks}
    for i, q_label in enumerate(labels):
        if np.sum(labels == q_label) <= 1:
            continue
        sorted_lab = labels[rank_idx[i]]
        for k in ks:
            aps[k].append(average_precision_at_k(sorted_lab, q_label, k))
    return {k: float(np.mean(aps[k])) if aps[k] else 0.0 for k in ks}


def map_per_class(vectors, labels, ks=(5, 25)):
    sim = vectors @ vectors.T
    np.fill_diagonal(sim, -np.inf)
    rank_idx = np.argsort(sim, axis=1)[:, ::-1]
    results = {k: {} for k in ks}
    for i, q_label in enumerate(labels):
        if np.sum(labels == q_label) <= 1:
            continue
        sorted_lab = labels[rank_idx[i]]
        for k in ks:
            ap = average_precision_at_k(sorted_lab, q_label, k)
            results[k].setdefault(q_label, []).append(ap)
    return {k: {c: float(np.mean(v)) for c, v in results[k].items()} for k in ks}


def save_csv(summary, per_class, ks, out_file="map_efficient.csv"):
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Model", "k", "mAP_overall"])
        for k in ks:
            writer.writerow(["EfficientNetB0", k, summary[k]])
        writer.writerow([])
        writer.writerow(["Model", "k", "Class", "mAP"])
        for k in per_class:
            for c, v in per_class[k].items():
                writer.writerow(["EfficientNetB0", k, c, v])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paths", default="paths.pkl")
    ap.add_argument("--vectors_efficient", default="vectors.pkl")
    ap.add_argument("--ks", default="1,5,10,20")
    args = ap.parse_args()

    paths = load_pickle(args.paths)
    labels = labels_from_paths(paths)
    vec_eff = np.asarray(load_pickle(args.vectors_efficient), dtype=np.float32)

    def l2norm(x, eps=1e-12):
        n = np.linalg.norm(x, axis=1, keepdims=True)
        return x / np.maximum(n, eps)

    vec_eff = l2norm(vec_eff)
    ks = tuple(int(x) for x in args.ks.split(",") if x.strip())

    print("\nEvaluating EfficientNetB0 ...")
    mAP_eff = map_at_ks(vec_eff, labels, ks=ks)
    for k in ks:
        print(f"  mAP@{k}: {mAP_eff[k]:.4f}")

    print("\nPer-class evaluation (EfficientNetB0):")
    per_class_eff = map_per_class(vec_eff, labels, ks=(5, 25))
    for k in per_class_eff:
        print(f"  mAP@{k}:")
        for c, v in per_class_eff[k].items():
            print(f"    {c}: {v:.4f}")

    save_csv(mAP_eff, per_class_eff, ks)
    print("\nĐã lưu kết quả vào map_efficient.csv")


if __name__ == "__main__":
    main()
