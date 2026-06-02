//! Riot Data Dragon 接口:版本列表与下载地址拼接。

const VERSIONS_URL: &str = "https://ddragon.leagueoflegends.com/api/versions.json";

/// 获取全部可用版本号,数组首项为最新版(不变量 §9)。
#[tauri::command]
pub async fn list_versions() -> Result<Vec<String>, String> {
    let resp = reqwest::get(VERSIONS_URL)
        .await
        .map_err(|e| format!("请求版本列表失败:{e}"))?;
    if !resp.status().is_success() {
        return Err(format!("版本列表响应异常:HTTP {}", resp.status()));
    }
    let versions: Vec<String> = resp
        .json()
        .await
        .map_err(|e| format!("解析版本列表失败:{e}"))?;
    Ok(versions)
}

/// 拼接 dragontail 全量包下载地址(不变量 §9)。
pub fn dragontail_url(version: &str) -> String {
    format!("https://ddragon.leagueoflegends.com/cdn/dragontail-{version}.tgz")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dragontail_url_format() {
        assert_eq!(
            dragontail_url("14.10.1"),
            "https://ddragon.leagueoflegends.com/cdn/dragontail-14.10.1.tgz"
        );
    }

    /// 实测命中真实 Riot 接口,验证 reqwest 链路 + 接口可达 + JSON 解析。
    #[tokio::test]
    async fn list_versions_live() {
        let versions = list_versions().await.expect("应能获取版本列表");
        assert!(!versions.is_empty(), "版本列表不应为空");
        assert!(versions[0].contains('.'), "首个版本号应形如 x.y.z");
    }
}
