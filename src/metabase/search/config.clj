(ns metabase.search.config
  (:require [cheshire.core :as json]
            [honeysql.core :as hsql]
            [metabase.models :refer [Card Collection Dashboard Database Metric Pulse Segment Table]]
            [metabase.models.setting :refer [defsetting]]
            [metabase.util.i18n :refer [deferred-tru]]))

(defsetting search-typeahead-enabled
  (deferred-tru "Enable typeahead search in the Metabase navbar?")
  :type       :boolean
  :default    true
  :visibility :authenticated)

(def ^:dynamic *db-max-results*
  "Number of raw results to fetch from the database. This number is in place to prevent massive application DB load by
  returning tons of results; this number should probably be adjusted downward once we have UI in place to indicate
  that results are truncated.

  Under normal situations it shouldn't be rebound, but it's dynamic to make unit testing easier."
  1000)

(def ^:const max-filtered-results
  "Number of results to return in an API response"
  1000)

(def ^:const stale-time-in-days
  "Results older than this number of days are all considered to be equally old. In other words, there is a ranking
  bonus for results newer than this (scaled to just how recent they are). c.f. `search.scoring/recency-score`"
  180)

(def ^:const dashboard-count-ceiling
  "Results in more dashboards than this are all considered to be equally popular."
  50)

(def ^:const surrounding-match-context
  "Show this many words of context before/after matches in long search results"
  2)

(def searchable-db-models
  "Models that can be searched."
  #{Dashboard Metric Segment Card Collection Table Pulse Database})

(def model-to-db-model
  "Mapping from string model to the Toucan model backing it."
  {"dashboard"  Dashboard
   "metric"     Metric
   "segment"    Segment
   "card"       Card
   "dataset"    Card
   "collection" Collection
   "table"      Table
   "pulse"      Pulse
   "database"   Database})

(def all-models
  "All valid models to search for. The order of this list also influences the order of the results: items earlier in the
  list will be ranked higher."
  ["dashboard" "metric" "segment" "card" "dataset" "collection" "table" "pulse" "database"])

(def ^:const displayed-columns
  "All of the result components that by default are displayed by the frontend."
  #{:name :display_name :collection_name :description})

(defmulti searchable-columns-for-model
  "The columns that will be searched for the query."
  {:arglists '([model])}
  (fn [model] model))

(defmethod searchable-columns-for-model :default
  [_]
  [:name])

(defmethod searchable-columns-for-model "card"
  [_]
  [:name
   :dataset_query
   :description])

(defmethod searchable-columns-for-model "dashboard"
  [_]
  [:name
   :description])

(defmethod searchable-columns-for-model "database"
  [_]
  [:name
   :description])

(defmethod searchable-columns-for-model "table"
  [_]
  [:name
   :display_name])

(def ^:private default-columns
  "Columns returned for all models."
  [:id :name :description :archived :updated_at])

(def ^:private favorite-col
  "Case statement to return boolean values of `:favorite` for Card and Dashboard."
  [(hsql/call :case [:not= :fave.id nil] true :else false) :favorite])

(def ^:private dashboardcard-count-col
  "Subselect to get the count of associated DashboardCards"
   [{:select [:%count.*]
     :from   [:report_dashboardcard]
     :where  [:= :report_dashboardcard.card_id :card.id]}
    :dashboardcard_count])

(def ^:private table-columns
  "Columns containing information about the Table this model references. Returned for Metrics and Segments."
  [:table_id
   [:table.db_id       :database_id]
   [:table.schema      :table_schema]
   [:table.name        :table_name]
   [:table.description :table_description]])

(defmulti columns-for-model
  "The columns that will be returned by the query for `model`, excluding `:model`, which is added automatically."
  {:arglists '([model])}
  (fn [model] model))

(defmethod columns-for-model "card"
  [_]
  (conj default-columns :collection_id :collection_position :dataset_query
        [:collection.name :collection_name]
        [:collection.authority_level :collection_authority_level]
        [{:select   [:status]
          :from     [:moderation_review]
          :where    [:and
                     [:= :moderated_item_type "card"]
                     [:= :moderated_item_id :card.id]
                     [:= :most_recent true]]
          ;; order by and limit just in case a bug lets the invariant of only one most_recent is violated. we dont'
          ;; want to error in this query
          :order-by [[:id :desc]]
          :limit    1}
         :moderated_status]
        favorite-col dashboardcard-count-col))

(defmethod columns-for-model "dashboard"
  [_]
  (conj default-columns :collection_id :collection_position favorite-col
        [:collection.name :collection_name]
        [:collection.authority_level :collection_authority_level]))

(defmethod columns-for-model "database"
  [_]
  [:id :name :description :updated_at])

(defmethod columns-for-model "pulse"
  [_]
  [:id :name :collection_id [:collection.name :collection_name]])

(defmethod columns-for-model "collection"
  [_]
  (conj (remove #{:updated_at} default-columns) [:id :collection_id] [:name :collection_name]
        [:authority_level :collection_authority_level]))

(defmethod columns-for-model "segment"
  [_]
  (into default-columns table-columns))

(defmethod columns-for-model "metric"
  [_]
  (into default-columns table-columns))

(defmethod columns-for-model "table"
  [_]
  [:id
   :name
   :display_name
   :description
   :updated_at
   [:id :table_id]
   [:db_id :database_id]
   [:schema :table_schema]
   [:name :table_name]
   [:description :table_description]])

(defmulti column->string
  "Turn a complex column into a string"
  (fn [_column-value model column-name]
    [(keyword model) column-name]))

(defmethod column->string :default
  [value _ _]
  value)

(defmethod column->string [:card :dataset_query]
  [value _ _]
  (let [query (json/parse-string value true)]
    (if (= "native" (:type query))
      (-> query :native :query)
      "")))
