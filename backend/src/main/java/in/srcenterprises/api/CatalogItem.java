package in.srcenterprises.api;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
@Entity
@Table(name="catalog_items")
public class CatalogItem {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
  @NotBlank @Size(max=150) @Column(nullable=false) public String name;
  @NotBlank @Size(max=100) @Column(nullable=false) public String category;
  @Size(max=1500) @Column(length=1500) public String description;
  @Size(max=1000) public String imageUrl;
  @Size(max=1000) public String demoVideoUrl;
  @NotNull public Boolean published=false;
  @NotNull public Boolean fireworks=true;
  @Version public Long version;
}
