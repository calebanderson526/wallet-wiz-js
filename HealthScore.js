exports.calculate_scores = (holders) => {
    for (let i = 0; i < holders.length; i++) {
        const holder = holders[i];
        var wallet_score = 0
        if (holder.wallet_size !== undefined) {
            wallet_score += wallet_size_score(holder.wallet_value);
        }
        if (holder.wallet_age !== undefined) {
            wallet_score += wallet_age_score(holder.wallet_age);
        }
        if (holder.avg_time !== undefined) {
            wallet_score += avg_time_score(holder.avg_time);
        }
        if (holder.tx_count !== undefined) {
            wallet_score += transaction_count_score(holder.tx_count);
        }
        if (holder.rug_count !== undefined && holder.ape_count !== undefined) {
            wallet_score += rug_count_score(holder.rug_count, holder.ape_count)
        }
        holders[i].wallet_score = wallet_score
    }
    return holders
}

const rug_count_score = (rug_count, ape_count) => {
    var score = 0
    var ratio = ape_count / rug_count
    if (rug_count == 0 && ape_count == 0) {
        return score
    } else if (rug_count == 0) {
        return 5
    } else if (ratio >= 10) {
        return 10
    } else if (ratio >= 3) {
        return 5
    } else if (ratio >= 2) {
        return 0
    } else if (ratio >= 1.5) {
        return -5
    } else {
        return -20
    }
}

const wallet_size_score = (wallet_size) => {
    if (wallet_size > 10000) {
        return 10;
    } else if (wallet_size > 2000) {
        return 5;
    } else if (wallet_size > 500) {
        return 3;
    } else if (wallet_size > 50) {
        return 0;
    } else {
        return -5;
    }
}

function wallet_age_score(wallet_age) {
    if (wallet_age > 150) {
        return 5;
    } else if (wallet_age > 50) {
        return 3;
    } else if (wallet_age > 10) {
        return 1;
    } else if (wallet_age > 3) {
        return 0;
    } else if (wallet_age > 1) {
        return -3;
    } else {
        return -5;
    }
}

function avg_time_score(avg_time) {
    if (avg_time > 50) {
        return 5;
    } else if (avg_time > 20) {
        return 3;
    } else if (avg_time > 10) {
        return 1;
    } else if (avg_time > 5) {
        return 0;
    } else if (avg_time > 2) {
        return -3;
    } else if (avg_time > 1) {
        return -5;
    } else {
        return -7;
    }
}

function transaction_count_score(transaction_count) {
    if (transaction_count > 500) {
        return 2;
    } else if (transaction_count > 200) {
        return 3;
    } else if (transaction_count > 50) {
        return 5;
    } else if (transaction_count > 25) {
        return 3;
    } else if (transaction_count > 10) {
        return 0;
    } else if (transaction_count > 5) {
        return -2;
    } else {
        return -5;
    }
}
